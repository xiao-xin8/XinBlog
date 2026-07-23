import {
  AppBar,
  Avatar,
  Box,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  alpha,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { LogoutConfirmDialog } from '@/components/Common/LogoutConfirmDialog';
import { Menu as MenuIcon, Person, Search, Settings, AccountCircle, Logout, ArrowBack } from '@mui/icons-material';
import { useState, type RefObject } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/components/Common/ThemeToggle';
import { Logo } from '@/components/Common/Logo';
import { useAuthStore } from '@/stores/authStore';
import { useScrollDirection } from '@/hooks/useScrollDirection';

interface NavBarProps {
  onMenuClick: () => void;
  drawerOpen?: boolean;
  drawerWidth?: number;
  scrollTargetRef?: RefObject<HTMLElement | null>;
}

export function NavBar({ onMenuClick, drawerOpen = false, drawerWidth = 0, scrollTargetRef }: NavBarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const { hidden } = useScrollDirection(64, scrollTargetRef);
  const { isAuthenticated, user, logout } = useAuthStore();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [searchValue, setSearchValue] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const userMenuOpen = Boolean(anchorEl);

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchValue.trim();
    if (trimmed) {
      navigate(`/?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const handleMobileSearchOpen = () => {
    setMobileSearchOpen(true);
  };

  const handleMobileSearchClose = () => {
    setMobileSearchOpen(false);
    setSearchValue('');
  };

  return (
    <AppBar
      position="fixed"
      color="inherit"
      elevation={0}
      sx={{
        backdropFilter: 'blur(12px)',
        backgroundColor: (theme) =>
          alpha(
            theme.palette.background.paper,
            theme.palette.mode === 'light' ? 0.85 : 0.8
          ),
        transition: theme.transitions.create(['width', 'margin-left', 'transform'], {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        width: !isMobile && drawerOpen && drawerWidth > 0 ? `calc(100% - ${drawerWidth}px)` : '100%',
        marginLeft: !isMobile && drawerOpen && drawerWidth > 0 ? `${drawerWidth}px` : 0,
        transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <IconButton
            edge="start"
            onClick={onMenuClick}
            aria-label="打开导航菜单"
            sx={{
              display: { md: 'none' },
              color: 'text.primary',
              borderRadius: 1,
            }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: { md: 'none' } }}>
            <Logo />
          </Box>
        </Box>

        <Box
          component="form"
          onSubmit={handleSearchSubmit}
          sx={{
            display: { xs: 'none', sm: 'flex' },
            alignItems: 'center',
            flex: 1,
            maxWidth: 480,
            mx: 4,
            px: 2,
            py: 0.75,
            borderRadius: 1,
            backgroundColor: (theme) =>
              theme.palette.mode === 'light'
                ? alpha(theme.palette.primary.main, 0.06)
                : alpha(theme.palette.common.white, 0.06),
            transition: theme.transitions.create(['background-color', 'box-shadow'], {
              easing: theme.transitions.easing.easeInOut,
              duration: theme.transitions.duration.short,
            }),
            '&:hover': {
              backgroundColor: (theme) =>
                theme.palette.mode === 'light'
                  ? alpha(theme.palette.primary.main, 0.1)
                  : alpha(theme.palette.common.white, 0.1),
            },
            '&:focus-within': {
              backgroundColor: (theme) =>
                theme.palette.mode === 'light'
                  ? alpha(theme.palette.primary.main, 0.14)
                  : alpha(theme.palette.common.white, 0.14),
              boxShadow: (theme) => `0 0 0 2px ${alpha(theme.palette.primary.main, 0.25)}`,
            },
          }}
        >
          <Search sx={{ color: 'text.secondary', mr: 1, fontSize: 20 }} />
          <InputBase
            placeholder="搜索文章..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            inputProps={{ 'aria-label': '搜索文章' }}
            sx={{
              flex: 1,
              typography: 'body2',
              '& input::placeholder': {
                color: 'text.secondary',
                opacity: 0.7,
              },
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="搜索文章">
            <IconButton
              onClick={handleMobileSearchOpen}
              aria-label="搜索文章"
              sx={{
                display: { sm: 'none' },
                color: 'text.secondary',
                borderRadius: 1,
                width: { xs: 44, sm: 36 },
                height: { xs: 44, sm: 36 },
              }}
            >
              <Search />
            </IconButton>
          </Tooltip>
          <ThemeToggle />

          {isAuthenticated && user ? (
            <>
              <Tooltip title="账户菜单">
                <IconButton
                  onClick={handleUserMenuOpen}
                  size="small"
                  aria-label="账户菜单"
                  aria-controls={userMenuOpen ? 'user-menu' : undefined}
                  aria-haspopup="true"
                  aria-expanded={userMenuOpen ? 'true' : undefined}
                  sx={{ ml: 0.5, width: { xs: 44, sm: 36 }, height: { xs: 44, sm: 36 } }}
                >
                  <Avatar
                    src={user.avatar || undefined}
                    sx={{
                      width: { xs: 36, sm: 32 },
                      height: { xs: 36, sm: 32 },
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    {user.username.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                id="user-menu"
                anchorEl={anchorEl}
                open={userMenuOpen}
                onClose={handleUserMenuClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{
                  sx: {
                    mt: 1,
                    borderRadius: 1,
                    minWidth: 180,
                    boxShadow: (theme) =>
                      theme.palette.mode === 'light'
                        ? `0 8px 32px ${alpha(theme.palette.primary.main, 0.12)}`
                        : `0 8px 32px ${alpha(theme.palette.common.black, 0.4)}`,
                  },
                }}
              >
                <MenuItem
                  component={Link}
                  to="/profile"
                  onClick={handleUserMenuClose}
                >
                  <AccountCircle fontSize="small" sx={{ mr: 1.5 }} />
                  个人中心
                </MenuItem>
                {user?.role === 'super_admin' && (
                  <MenuItem
                    component={Link}
                    to="/admin"
                    onClick={handleUserMenuClose}
                  >
                    <Settings fontSize="small" sx={{ mr: 1.5 }} />
                    管理后台
                  </MenuItem>
                )}
                <MenuItem
                  onClick={() => {
                    handleUserMenuClose();
                    setLogoutOpen(true);
                  }}
                >
                  <Logout fontSize="small" sx={{ mr: 1.5 }} />
                  退出登录
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Tooltip title="登录">
              <IconButton
                component={Link}
                to="/admin/login"
                aria-label="登录"
                sx={{
                  color: 'text.secondary',
                  borderRadius: 1,
                  width: { xs: 44, sm: 36 },
                  height: { xs: 44, sm: 36 },
                }}
              >
                <Person />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Toolbar>

      {mobileSearchOpen && (
        <Toolbar
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bgcolor: 'background.paper',
            px: { xs: 1.5, sm: 3 },
            gap: 1,
          }}
        >
          <IconButton
            onClick={handleMobileSearchClose}
            aria-label="关闭搜索"
            sx={{ color: 'text.primary', width: 44, height: 44, flexShrink: 0 }}
          >
            <ArrowBack />
          </IconButton>
          <Box
            component="form"
            onSubmit={handleSearchSubmit}
            sx={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              backgroundColor: (theme) =>
                theme.palette.mode === 'light'
                  ? alpha(theme.palette.primary.main, 0.06)
                  : alpha(theme.palette.common.white, 0.06),
            }}
          >
            <Search sx={{ color: 'text.secondary', mr: 1, fontSize: 20, flexShrink: 0 }} />
            <InputBase
              autoFocus
              placeholder="搜索文章..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              inputProps={{ 'aria-label': '搜索文章' }}
              sx={{
                flex: 1,
                typography: 'body2',
                '& input::placeholder': {
                  color: 'text.secondary',
                  opacity: 0.7,
                },
              }}
            />
          </Box>
        </Toolbar>
      )}

      <LogoutConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          logout();
        }}
      />
    </AppBar>
  );
}
