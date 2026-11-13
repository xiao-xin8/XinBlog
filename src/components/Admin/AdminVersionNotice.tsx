import { useEffect, useState } from 'react';
import { Alert, AlertTitle, Button, List, ListItem, ListItemIcon, ListItemText, alpha, useTheme } from '@mui/material';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { APP_VERSION, SITE_HOMEPAGE_URL } from '@/config';

interface VersionLog {
  version: string;
  title?: string;
  content?: string[];
}

interface VersionInfo {
  latest: string;
  url?: string;
  logs?: VersionLog[];
}

// 简单语义化版本比较：返回值 > 0 表示 a 比 b 新
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

// 进入管理后台时请求官网根目录 version.json，比对当前版本与最新版本，
// 若存在新版本则在后台顶部展示更新提示与更新日志。
export function AdminVersionNotice() {
  const theme = useTheme();
  const [info, setInfo] = useState<VersionInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    fetch(`${SITE_HOMEPAGE_URL}/version.json`, { signal: controller.signal, cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: VersionInfo) => {
        if (mounted) setInfo(data);
      })
      .catch(() => {
        // 官网不可达或解析失败时静默忽略，不打扰用户
        if (mounted) setFailed(true);
      });
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  if (failed || !info || !info.latest) return null;

  const latest = String(info.latest).replace(/^v/i, '');
  // 当前版本不低于最新版本时不提示（含无更新 / 当前版本更新的情况）
  if (compareVersions(APP_VERSION, latest) >= 0) return null;

  const log = info.logs?.find((l) => String(l.version).replace(/^v/i, '') === latest);
  const changelogUrl = info.url || `${SITE_HOMEPAGE_URL}/changelog.html`;

  return (
    <Alert
      severity="info"
      sx={{
        mb: 3,
        borderRadius: (t) => Math.max(8, t.shape.borderRadius - 4),
        '& .MuiAlert-icon': { alignItems: 'center' },
      }}
    >
      <AlertTitle sx={{ fontWeight: 700 }}>
        发现新版本 v{latest}（当前版本 v{APP_VERSION}）
      </AlertTitle>
      {log?.content?.length ? (
        <List dense disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
          {log.content.map((item, i) => (
            <ListItem key={i} disableGutters sx={{ alignItems: 'flex-start', py: 0 }}>
              <ListItemIcon sx={{ minWidth: 28, mt: 0.25 }}>
                <CheckCircleIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={item}
                primaryTypographyProps={{
                  variant: 'body2',
                  sx: { color: alpha(theme.palette.text.primary, 0.85), lineHeight: 1.7 },
                }}
              />
            </ListItem>
          ))}
        </List>
      ) : null}
      <Button
        component="a"
        href={changelogUrl}
        target="_blank"
        rel="noreferrer"
        size="small"
        variant="contained"
        startIcon={<NewReleasesIcon />}
        sx={{ mt: 0.5 }}
      >
        查看更新日志
      </Button>
    </Alert>
  );
}
