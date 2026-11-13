import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 语音通话核心 hook（基于 WebRTC 的浏览器 P2P 直连）。
 *
 * 信令复用聊天 WebSocket（由 useChatRoom 提供 sendSignal / onSignal）：
 * 本 hook 只负责"呼叫控制 + RTCPeerConnection 生命周期 + 媒体采集/播放"，
 * 不直接碰 WebSocket。
 *
 * 连接策略：仅 STUN 打洞、无 TURN 兜底。打洞失败（对称 NAT 等）时
 * RTCPeerConnection 进入 failed/disconnected，如实提示并自动结束，不静默失败。
 */

const RING_TIMEOUT_MS = 20000; // 振铃/等待对方接听超时
const ENDING_CLEANUP_MS = 2500; // "通话结束"提示停留时长后回到 idle
const DISCONNECT_GRACE_MS = 6000; // P2P 断流宽限：超时仍没恢复则判定失败
const CONNECT_TIMEOUT_MS = 15000; // 进入"接通中"后的总超时：连不通就断，绝不无限转圈

// STUN 配置（基于国内实测，2026-08 本机 UDP 探测）：
//  - stun.miwifi.com        OK 38~57ms，国内直连，返回真实家宽公网 IP（首选）
//  - stun.chat.bilibili.com OK 34ms，国内可用
//  - stun.l.google.com      OK 76ms（直连可达时保留作兜底）
//  - stun.cloudflare.com    OK 221ms（最后兜底）
// 已实测剔除：stun.qq.com（超时/已停用）、stun.aliyun.com（域名不存在）、stun.yy.com（超时）
const STUN_SERVERS = [
  'stun:stun.miwifi.com:3478',
  'stun:stun.chat.bilibili.com:3478',
  'stun:stun.l.google.com:19302',
  'stun:stun.cloudflare.com:3478',
];

export type CallState = 'idle' | 'dialing' | 'ringing' | 'connecting' | 'connected' | 'ending';
/** 通话类型：audio=语音，video=视频（同一套信令，仅媒体约束不同） */
export type CallKind = 'audio' | 'video';

function genCallId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 按通话类型取媒体约束：视频开摄像头（720p），语音只开麦克风 */
function mediaConstraints(kind: CallKind): MediaStreamConstraints {
  return kind === 'video'
    ? { audio: true, video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } }
    : { audio: true };
}

export interface VoiceCallHandlers {
  state: CallState;
  /** 当前通话类型（audio 语音 / video 视频） */
  kind: CallKind;
  /** 对端昵称 */
  peerName: string;
  /** 是否已静音 */
  muted: boolean;
  /** 是否已关闭摄像头（仅视频通话） */
  cameraMuted: boolean;
  /** 接通后已进行的秒数 */
  durationSec: number;
  /** 结束阶段的说明文案（如"对方已挂断"） */
  endedNote: string;
  /** 对端媒体流（audio 用 <audio>，video 用 <video> 渲染） */
  remoteStream: MediaStream | null;
  /** 本地媒体流（视频通话用于预览自己的摄像头） */
  localStream: MediaStream | null;
  /** 发起对某人（在线昵称）的通话；kind 默认语音 */
  startCall: (peerName: string, kind?: CallKind) => void;
  /** 被叫方：接听 */
  accept: () => void;
  /** 被叫方：拒接 */
  reject: () => void;
  /** 任意状态：挂断 */
  hangup: () => void;
  /** 静音开关 */
  toggleMute: () => void;
  /** 摄像头开关（仅视频通话有效） */
  toggleCamera: () => void;
  /** 把收到的信令消息喂给 hook（由使用方接到 onSignal 后调用） */
  handleSignal: (data: Record<string, unknown>) => void;
}

interface UseVoiceCallOptions {
  /** 当前用户昵称（用于过滤发给自己的信令，防串线） */
  selfName: string;
  /** 发送信令（来自 useChatRoom.sendSignal） */
  sendSignal: (payload: Record<string, unknown>) => boolean;
  /** WebSocket 是否存活；断开时自动结束通话 */
  connected: boolean;
}

export function useVoiceCall({ selfName, sendSignal, connected }: UseVoiceCallOptions): VoiceCallHandlers {
  const [state, setState] = useState<CallState>('idle');
  const [kind, setKind] = useState<CallKind>('audio');
  const [peerName, setPeerName] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraMuted, setCameraMuted] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [endedNote, setEndedNote] = useState('');
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // ---- 不稳定值全部走 ref，保证 handleSignal 等回调稳定（useCallback 空依赖） ----
  const stateRef = useRef<CallState>('idle');
  const roleRef = useRef<'caller' | 'callee' | null>(null);
  const callIdRef = useRef<string | null>(null);
  const peerRef = useRef<string>('');
  const kindRef = useRef<CallKind>('audio');
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const ringTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectedAtRef = useRef(0);
  const mutedRef = useRef(false);
  const cameraMutedRef = useRef(false);
  const selfNameRef = useRef(selfName);
  const sendSignalRef = useRef(sendSignal);
  const duringEndingRef = useRef(false);
  // remoteDescription 未就绪前收到的 ICE candidate，先缓存，SetRemote 后统一回放（否则会被丢弃导致首次连接失败）
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    selfNameRef.current = selfName;
  }, [selfName]);
  useEffect(() => {
    sendSignalRef.current = sendSignal;
  }, [sendSignal]);

  const setCallState = useCallback((s: CallState) => {
    stateRef.current = s;
    setState(s);
  }, []);

  /** SetRemote 成功后，把早到并缓存的 ICE candidate 统一补 feed 进 PC */
  const flushPendingIce = useCallback(() => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const queue = pendingIceRef.current;
    if (!queue.length) return;
    pendingIceRef.current = [];
    queue.forEach((c) => {
      try { void pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* noop */ }
    });
  }, []);

  /** 向当前通话对端发一条信令（自带 to = peer, callId） */
  const signal = useCallback((type: string, payload: Record<string, unknown> = {}) => {
    const to = peerRef.current;
    if (!to) return;
    sendSignalRef.current({ type, to, callId: callIdRef.current ?? '', ...payload });
  }, []);

  const stopLocalStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
  }, []);

  const destroyPeer = useCallback(() => {
    const pc = pcRef.current;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      pcRef.current = null;
      pendingIceRef.current = []; // 清空候选缓冲，避免残留污染下次通话
    }
  }, []);

  const clearCallTimers = useCallback(() => {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
    if (discTimerRef.current) {
      clearTimeout(discTimerRef.current);
      discTimerRef.current = null;
    }
    if (connectTimerRef.current) {
      clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  /** 结束通话并复位到 idle；note 非空则先短暂显示"通话结束"说明 */
  const endCall = useCallback(
    (note: string | null = null) => {
      duringEndingRef.current = true;
      clearCallTimers();
      destroyPeer();
      stopLocalStream();
      roleRef.current = null;
      callIdRef.current = null;
      peerRef.current = '';
      kindRef.current = 'audio';
      setKind('audio');
      mutedRef.current = false;
      setMuted(false);
      cameraMutedRef.current = false;
      setCameraMuted(false);
      setDurationSec(0);
      setPeerName('');
      setRemoteStream(null);
      setLocalStream(null);
      if (note) {
        setEndedNote(note);
        setCallState('ending');
        setTimeout(() => {
          duringEndingRef.current = false;
          setEndedNote('');
          setCallState('idle'); // 必须用 setCallState：同步 stateRef，否则 stateRef 停在 'ending' 导致之后无法再发起/接听
        }, ENDING_CLEANUP_MS);
      } else {
        duringEndingRef.current = false;
        setEndedNote('');
        setCallState('idle');
      }
    },
    [clearCallTimers, destroyPeer, stopLocalStream, setCallState, duringEndingRef]
  );

  /** 进入"接通中"后启动总超时：限定时间内连不通就断开，避免无限转圈/对方离场后卡死 */
  const armConnectTimeout = useCallback(() => {
    if (connectTimerRef.current) clearTimeout(connectTimerRef.current);
    connectTimerRef.current = setTimeout(() => {
      if (stateRef.current === 'connecting' || stateRef.current === 'dialing') {
        endCall('连接超时，请重试');
      }
    }, CONNECT_TIMEOUT_MS);
  }, [endCall]);

  const beginConnected = useCallback(() => {
    clearCallTimers();
    connectedAtRef.current = Date.now();
    setDurationSec(0);
    setCallState('connected');
    durationTimerRef.current = setInterval(() => {
      setDurationSec(Math.floor((Date.now() - connectedAtRef.current) / 1000));
    }, 1000);
  }, [clearCallTimers, setCallState]);

  /** 创建 RTCPeerConnection：采集候选、接收对方音频流、监听连接状态 */
  const createPeer = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: STUN_SERVERS }] });
    pc.onicecandidate = (e) => {
      if (e.candidate && callIdRef.current) {
        signal('signal.ice', { candidate: e.candidate.toJSON() });
      }
    };
    pc.ontrack = (e) => {
      if (e.streams?.[0]) setRemoteStream(e.streams[0]);
    };
    pc.onconnectionstatechange = () => {
      const cs = pc.connectionState;
      if (cs === 'connected') {
        if (pcRef.current === pc) beginConnected();
      } else if (cs === 'disconnected') {
        // 打洞成功后短暂断流：给宽限时间自动恢复，超时仍未恢复则判失败
        if (pcRef.current !== pc) return;
        if (discTimerRef.current) clearTimeout(discTimerRef.current);
        discTimerRef.current = setTimeout(() => {
          if (pcRef.current === pc && pc.connectionState === 'disconnected') {
            endCall('连接失败');
          }
        }, DISCONNECT_GRACE_MS);
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' && pcRef.current === pc) {
        endCall('连接失败');
      }
    };
    pcRef.current = pc;
    return pc;
  }, [signal, beginConnected, endCall]);

  /** 呼叫方：取媒体 + 建 PC + 发 offer（在收到对方 accept 后触发） */
  const startOutgoingMedia = useCallback(async () => {
    setCallState('connecting'); // 进入"接通中"，UI 显示转圈
    armConnectTimeout();
    if (!navigator.mediaDevices?.getUserMedia) {
      endCall('当前环境不支持媒体采集');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints(kindRef.current));
      localStreamRef.current = stream;
      setLocalStream(stream);
      mutedRef.current = false;
      setMuted(false);
      cameraMutedRef.current = false;
      setCameraMuted(false);
      const pc = createPeer();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      signal('signal.offer', { sdp: pc.localDescription });
    } catch {
      signal('call.hangup');
      endCall('无法访问麦克风或摄像头，通话已取消');
    }
  }, [createPeer, signal, endCall, armConnectTimeout, setCallState]);

  /** 呼叫方：处理对方返回的 answer */
  const handleAnswer = useCallback(async (sdp: unknown) => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp as RTCSessionDescriptionInit));
      flushPendingIce(); // 远端描述就绪后，补 feed 早到缓存的 candidate
    } catch {
      // SDP 不匹配等异常：直接结束
      endCall('协商失败');
    }
  }, [flushPendingIce, endCall]);

  /** 被叫方：处理 caller 的 offer，返回 answer */
  const handleOffer = useCallback(async (sdp: unknown) => {
    const pc = pcRef.current;
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp as RTCSessionDescriptionInit));
      flushPendingIce(); // 远端描述就绪后，补 feed 早到缓存的 candidate
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      signal('signal.answer', { sdp: pc.localDescription });
    } catch {
      endCall('协商失败');
    }
  }, [signal, endCall, flushPendingIce]);

  /** 任意一方：处理对端 ICE candidate。
   * 远端描述未就绪时（candidate 早于 offer/answer 到达，首次连接常见）先缓存，
   * 等 setRemoteDescription 后由 flushPendingIce 统一回放，避免漏 candidate 导致连不通。 */
  const handleIce = useCallback((candidate: unknown) => {
    const pc = pcRef.current;
    if (!pc || !candidate) return;
    try {
      if (pc.remoteDescription) {
        void pc.addIceCandidate(new RTCIceCandidate(candidate as RTCIceCandidateInit));
      } else {
        pendingIceRef.current.push(candidate as RTCIceCandidateInit); // 先存起来
      }
    } catch {
      // 个别 candidate 无法解析：忽略，不影响整体
    }
  }, []);

  // WebSocket 断开：通话无法继续，直接复位（不给对端发挂断，对端走 quit 感知）
  useEffect(() => {
    if (!connected && stateRef.current !== 'idle' && stateRef.current !== 'ending') {
      clearCallTimers();
      destroyPeer();
      stopLocalStream();
      roleRef.current = null;
      callIdRef.current = null;
      peerRef.current = '';
      setPeerName('');
      setDurationSec(0);
      setRemoteStream(null);
      setCallState('idle');
    }
  }, [connected, clearCallTimers, destroyPeer, stopLocalStream, setCallState]);

  // 组件卸载：释放所有资源
  useEffect(
    () => () => {
      clearCallTimers();
      destroyPeer();
      stopLocalStream();
    },
    [clearCallTimers, destroyPeer, stopLocalStream]
  );

  /**
   * 核心信令入口：由 useChatRoom 的 onSignal 喂入。根据本地角色与 callId 做幂等处理，
   * 避免串线 / 收到旧会话消息误伤当前通话。
   */
  const handleSignal = useCallback(
    (data: Record<string, unknown>) => {
      const type = String(data.type ?? '');
      const from = data.from as string | undefined;
      const callId = data.callId as string | undefined;
      const self = selfNameRef.current;
      if (from && from === self) return; // 自己发出的消息不回显
      if (data.to && String(data.to) !== self) return; // 防御：目标不是自己也忽略
      if (!from) return;

      switch (type) {
        case 'call.invite': {
          if (stateRef.current !== 'idle') {
            signal('call.busy');
            return;
          }
          roleRef.current = 'callee';
          peerRef.current = from;
          callIdRef.current = callId ?? genCallId();
          kindRef.current = data.kind === 'video' ? 'video' : 'audio';
          setKind(kindRef.current);
          setPeerName(from);
          setCallState('ringing');
          if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
          ringTimerRef.current = setTimeout(() => {
            signal('call.timeout');
            endCall('对方未接听，已取消');
          }, RING_TIMEOUT_MS);
          return;
        }
        case 'call.accept': {
          if (roleRef.current !== 'caller' || callIdRef.current !== callId) return;
          if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
          startOutgoingMedia();
          return;
        }
        case 'call.reject': {
          if (roleRef.current !== 'caller' || callIdRef.current !== callId) return;
          if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
          endCall('对方已拒绝');
          return;
        }
        case 'call.busy': {
          if (roleRef.current !== 'caller' || callIdRef.current !== callId) return;
          if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
          endCall(data.reason === 'offline' ? '对方已离线' : '对方正忙');
          return;
        }
        case 'call.timeout': {
          if (roleRef.current !== 'caller' || callIdRef.current !== callId) return;
          if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
          endCall('对方未接听');
          return;
        }
        case 'call.hangup': {
          if (callIdRef.current !== callId) return;
          endCall('对方已挂断');
          return;
        }
        case 'signal.offer': {
          if (roleRef.current !== 'callee' || callIdRef.current !== callId) return;
          handleOffer(data.sdp);
          return;
        }
        case 'signal.answer': {
          if (roleRef.current !== 'caller' || callIdRef.current !== callId) return;
          handleAnswer(data.sdp);
          return;
        }
        case 'signal.ice': {
          if (callIdRef.current !== callId) return;
          handleIce(data.candidate);
          return;
        }
        default:
          return;
      }
    },
    [signal, startOutgoingMedia, handleOffer, handleAnswer, handleIce, endCall, setPeerName, setCallState]
  );

  const startCall = useCallback(
    (name: string, kind: CallKind = 'audio') => {
      if (stateRef.current !== 'idle') return;
      if (!name || name === selfNameRef.current) return;
      roleRef.current = 'caller';
      peerRef.current = name;
      callIdRef.current = genCallId();
      kindRef.current = kind;
      setKind(kind);
      setPeerName(name);
      setCallState('dialing');
      signal('call.invite', { kind });
      if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
      ringTimerRef.current = setTimeout(() => {
        if (stateRef.current === 'dialing') {
          signal('call.timeout');
          endCall('对方未接听，已取消');
        }
      }, RING_TIMEOUT_MS);
    },
    [signal, endCall, setPeerName, setCallState]
  );

  const accept = useCallback(async () => {
    if (stateRef.current !== 'ringing') return;
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    setCallState('connecting'); // 接听后进入"接通中"，UI 显示转圈
    armConnectTimeout();
    // 先取到媒体并建好 PC，再回 accept，确保 caller 的 offer 到达时 PC 已就绪
    try {
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints(kindRef.current));
      localStreamRef.current = stream;
      setLocalStream(stream);
      mutedRef.current = false;
      setMuted(false);
      cameraMutedRef.current = false;
      setCameraMuted(false);
      const pc = createPeer();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      signal('call.accept');
    } catch {
      signal('call.reject');
      endCall('无法访问麦克风或摄像头，已自动拒绝');
    }
  }, [signal, createPeer, endCall, armConnectTimeout, setCallState]);

  const reject = useCallback(() => {
    if (stateRef.current !== 'ringing') return;
    if (ringTimerRef.current) clearTimeout(ringTimerRef.current);
    signal('call.reject');
    endCall();
  }, [signal, endCall]);

  const hangup = useCallback(() => {
    if (stateRef.current === 'idle' || stateRef.current === 'ending') return;
    signal('call.hangup');
    endCall();
  }, [signal, endCall]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  }, []);

  const toggleCamera = useCallback(() => {
    if (kindRef.current !== 'video') return;
    const next = !cameraMutedRef.current;
    cameraMutedRef.current = next;
    setCameraMuted(next);
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
  }, []);

  return {
    state,
    kind,
    peerName,
    muted,
    cameraMuted,
    durationSec,
    endedNote,
    remoteStream,
    localStream,
    startCall,
    accept,
    reject,
    hangup,
    toggleMute,
    toggleCamera,
    handleSignal,
  };
}