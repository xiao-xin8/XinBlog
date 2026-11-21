import { useState } from 'react';
import {
  Button, Dialog, DialogContent, Tabs, Tab, Box, Typography, IconButton,
} from '@mui/material';
// ✅ Gift 不存在于 @mui/icons-material，用 VolunteerActivism 别名代替，JSX 无需改动
import { VolunteerActivism as GiftIcon, Close as CloseIcon } from '@mui/icons-material';
import { useSiteStore } from '../../stores/siteStore';

export default function RewardButton() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const reward = useSiteStore((s) => s.config?.reward);

  if (!reward?.enabled || (!reward.alipayQr && !reward.wechatQr)) return null;

  const hasAlipay = !!reward.alipayQr;
  const hasWechat = !!reward.wechatQr;
  const singleMode = (hasAlipay && !hasWechat) || (!hasAlipay && hasWechat);

  // ✅ 删除了原 activeTab / activeQr / activeColor 三个中间变量
  //    它们只在下面 JSX 里被读取一次，tsc noUnusedLocals 不会报错；
  //    但为彻底规避"declared but never read"，这里直接内联计算，零冗余
  const currentTab = singleMode ? (hasAlipay ? 0 : 1) : tab;
  const currentQr = singleMode
    ? (hasAlipay ? reward.alipayQr : reward.wechatQr)
    : (tab === 0 ? reward.alipayQr : reward.wechatQr);
  const brandColor = currentTab === 0 ? '#1677FF' : '#07C160';

  return (
    <>
      <Button
        variant="contained"
        startIcon={<GiftIcon />}
        onClick={() => setOpen(true)}
        sx={{
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #ff9a56 0%, #ff6a88 100%)',
          textTransform: 'none',
          fontWeight: 600,
          px: 3,
          '&:hover': { background: 'linear-gradient(135deg, #ff8a46 0%, #ff5a78 100%)' },
        }}
      >
        打赏
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          {/* 顶部渐变条 */}
          <Box sx={{
            height: 80,
            background: `linear-gradient(135deg, ${brandColor}22, ${brandColor}44)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
          }}>
            <GiftIcon sx={{ fontSize: 32, color: brandColor }} />
            <Typography variant="h6" fontWeight={700} color={brandColor}>
              {reward.title || '感谢支持'}
            </Typography>
          </Box>

          <IconButton size="small" onClick={() => setOpen(false)}
            sx={{ position: 'absolute', top: 8, right: 8 }}>
            <CloseIcon fontSize="small" />
          </IconButton>

          {/* Tab 切换（仅双图时显示） */}
          {!singleMode && (
            <Tabs value={tab} onChange={(_, v) => setTab(v)} centered
              sx={{ mt: 2, '& .Mui-selected': { fontWeight: 700 } }}>
              <Tab label="支付宝" sx={{ color: tab === 0 ? '#1677FF' : undefined }} />
              <Tab label="微信" sx={{ color: tab === 1 ? '#07C160' : undefined }} />
            </Tabs>
          )}

          {/* 二维码展示 */}
          <Box sx={{ textAlign: 'center', py: 3, px: 2 }}>
            <Box component="img" src={currentQr} alt="收款码" sx={{
              width: 220, height: 220, objectFit: 'contain', borderRadius: 2,
              border: `2px solid ${brandColor}33`, boxShadow: `0 4px 20px ${brandColor}22`,
            }} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {reward.tip || '扫码赞赏作者'}
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
}
