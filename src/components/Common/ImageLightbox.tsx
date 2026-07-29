import { Box, Fade, IconButton, Modal, Typography, alpha } from '@mui/material';
import { Close, ZoomIn, ZoomOut, RotateLeft } from '@mui/icons-material';
import { useCallback, useEffect, useRef, useState } from 'react';
interface ImageLightboxProps {
  open: boolean;
  src: string;
  alt?: string;
  onClose: () => void;
}
export function ImageLightbox({ open, src, alt, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);
  const clampScale = (value: number) => Math.min(Math.max(value, 0.5), 5);
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setScale((prev) => clampScale(prev + delta));
    },
    []
  );
  const handleZoomIn = () => setScale((prev) => clampScale(prev + 0.5));
  const handleZoomOut = () => setScale((prev) => clampScale(prev - 0.5));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      px: position.x,
      py: position.y,
    };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPosition({
      x: dragStartRef.current.px + (e.clientX - dragStartRef.current.x),
      y: dragStartRef.current.py + (e.clientY - dragStartRef.current.y),
    });
  };
  const handleMouseUp = () => setDragging(false);
  const handleDoubleClick = () => {
    if (scale > 1) {
      handleReset();
    } else {
      setScale(2);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeAfterTransition
      BackdropProps={{ timeout: 300 }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      <Fade in={open} timeout={300}>
        <Box
          ref={containerRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: (theme) => alpha(theme.palette.common.black, 0.92),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            cursor: dragging ? 'grabbing' : scale > 1 ? 'grab' : 'zoom-in',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              display: 'flex',
              gap: 1,
              zIndex: 10,
            }}
          >
            <IconButton onClick={handleZoomOut} sx={{ color: 'common.white', bgcolor: 'rgba(255,255,255,0.1)' }}>
              <ZoomOut />
            </IconButton>
            <IconButton onClick={handleZoomIn} sx={{ color: 'common.white', bgcolor: 'rgba(255,255,255,0.1)' }}>
              <ZoomIn />
            </IconButton>
            <IconButton onClick={handleReset} sx={{ color: 'common.white', bgcolor: 'rgba(255,255,255,0.1)' }}>
              <RotateLeft />
            </IconButton>
            <IconButton onClick={onClose} sx={{ color: 'common.white', bgcolor: 'rgba(255,255,255,0.1)' }}>
              <Close />
            </IconButton>
          </Box>
          {alt && (
            <Typography
              variant="caption"
              sx={{
                position: 'absolute',
                bottom: 16,
                left: '50%',
                transform: 'translateX(-50%)',
                color: 'common.white',
                opacity: 0.7,
                maxWidth: '80%',
                textAlign: 'center',
                px: 2,
              }}
            >
              {alt}
            </Typography>
          )}
          <Box
            component="img"
            src={src}
            alt={alt || ''}
            draggable={false}
            sx={{
              maxWidth: '90%',
              maxHeight: '90%',
              objectFit: 'contain',
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transition: dragging ? 'none' : 'transform 0.2s ease',
              userSelect: 'none',
            }}
          />
        </Box>
      </Fade>
    </Modal>
  );
}