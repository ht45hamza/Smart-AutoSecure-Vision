import React, { useState, useEffect, useRef } from 'react';
import { setRoi } from '../api';

const ROImodal = ({ cameraId, onClose }) => {
    const canvasRef = useRef(null);
    const imgRef = useRef(null);
    const [tool, setTool] = useState('rect');
    const [points, setPoints] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);

    const [feedTimestamp] = useState(Date.now());

    // ...

    // Reset when camera changes
    useEffect(() => {
        if (cameraId) {
            clearRoi();
        }
    }, [cameraId]);

    // ...



    const clearRoi = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setPoints([]);
        setIsDrawing(false);
    };

    const getCanvasCoordinates = (e) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();

        // Calculate scale (internal resolution / displayed size)
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // Mouse position relative to canvas display
        const clientX = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
        const clientY = (e.clientY || e.touches?.[0]?.clientY) - rect.top;

        return {
            x: Math.max(0, Math.min(canvas.width, clientX * scaleX)),
            y: Math.max(0, Math.min(canvas.height, clientY * scaleY))
        };
    };

    const handleMouseDown = (e) => {
        const { x, y } = getCanvasCoordinates(e);

        if (tool === 'poly') {
            // Snap to close
            if (points.length > 2) {
                const sx = points[0][0];
                const sy = points[0][1];
                const dist = Math.sqrt((x - sx) ** 2 + (y - sy) ** 2);
                if (dist < 25) {
                    handleSave(); // Or finalize shape logic
                    setIsDrawing(false);
                    return;
                }
            }
            setPoints([...points, [x, y]]);
            draw(x, y); // Visual feedback
            return;
        }

        setIsDrawing(true);
        if (tool === 'rect') setPoints([x, y, 0, 0]);
        else if (tool === 'circle') setPoints([x, y, 0]);
        else if (tool === 'freehand') setPoints([[x, y]]);
    };

    const handleMouseMove = (e) => {
        const { x, y } = getCanvasCoordinates(e);

        if (tool === 'poly') {
            draw(x, y); // Draw line to cursor
            return;
        }
        if (!isDrawing) return;

        const newPoints = [...points];
        if (tool === 'rect') {
            // Calculate width/height from start point
            newPoints[2] = x - newPoints[0];
            newPoints[3] = y - newPoints[1];
        } else if (tool === 'circle') {
            const dx = x - newPoints[0];
            const dy = y - newPoints[1];
            newPoints[2] = Math.sqrt(dx * dx + dy * dy);
        } else if (tool === 'freehand') {
            newPoints.push([x, y]);
        }
        setPoints(newPoints);
        draw(null, null, newPoints);
    };

    const handleMouseUp = () => {
        if (tool === 'poly') return;
        setIsDrawing(false);
    };

    const draw = (cursorX = null, cursorY = null, currentPoints = points) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !canvasRef.current) return;

        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
        ctx.beginPath();

        if (tool === 'rect' && currentPoints.length >= 4) {
            const [x, y, w, h] = currentPoints;
            // Normalize for canvas rect
            let rx = x, ry = y, rw = w, rh = h;
            // Allow negative width/height drawing
            ctx.rect(rx, ry, rw, rh);
            ctx.fill();
            ctx.stroke();
        } else if (tool === 'circle' && currentPoints.length >= 3) {
            ctx.arc(currentPoints[0], currentPoints[1], currentPoints[2], 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        } else if ((tool === 'poly' || tool === 'freehand') && currentPoints.length > 0) {
            ctx.moveTo(currentPoints[0][0], currentPoints[0][1]);
            for (let i = 1; i < currentPoints.length; i++) {
                ctx.lineTo(currentPoints[i][0], currentPoints[i][1]);
            }
            if (cursorX !== null && tool === 'poly') {
                ctx.lineTo(cursorX, cursorY);
            }
            if (!isDrawing && tool !== 'poly') ctx.closePath();
            ctx.stroke();
            if (!isDrawing) ctx.fill();
        }
    };

    const handleSave = async () => {
        if (!points || points.length === 0) return;
        if (!canvasRef.current || !imgRef.current) return;

        const w = parseFloat(canvasRef.current.width);
        const h = parseFloat(canvasRef.current.height);

        let roiData = {};

        if (tool === 'rect') {
            // [x, y, w, h]
            let [x, y, rw, rh] = points;
            // Normalize negative dimensions
            if (rw < 0) { x += rw; rw = Math.abs(rw); }
            if (rh < 0) { y += rh; rh = Math.abs(rh); }

            // Normalize to 0..1
            roiData = {
                type: 'rect',
                points: [x / w, y / h, rw / w, rh / h]
            };
        } else if (tool === 'circle') {
            // [x, y, r]
            // Radius normalization is tricky. Usually relative to width or max dim.
            // Let's assume normalized to width for now, or just send relative val.
            // Backend likely expects standard relative coords.
            roiData = {
                type: 'circle',
                points: [points[0] / w, points[1] / h, points[2] / w]
            };
        } else if (tool === 'poly' || tool === 'freehand') {
            // [[x,y], [x,y]...]
            const normalized = points.map(p => [p[0] / w, p[1] / h]);
            roiData = {
                type: 'poly', // Backend likely treats freehand as poly
                points: normalized
            };
        }

        try {
            console.log("Saving ROI:", roiData); // Debug
            await setRoi({
                id: cameraId,
                roi: roiData
            });
            onClose();
        } catch (e) {
            console.error(e);
            alert("Failed to save ROI. Check console.");
        }
    };

    // Keep canvas synced with image size
    useEffect(() => {
        if (!imgRef.current || !canvasRef.current) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === imgRef.current) {
                    const { width, height } = entry.contentRect;
                    canvasRef.current.width = width;
                    canvasRef.current.height = height;
                    // Redraw logic if needed, or just clear/keep points?
                    // Ideally we should scale existing points, but simplest is to clear or just let them stay (they are raw pixels)
                    // If we resize, raw pixel points become invalid relative to visual. 
                    // Better to clear or re-normalize? Clearing is safer for now to avoid confusion.
                    // But if it's just a tiny layout shift, clearing is annoying.
                    // Let's just update dimensions. The user is drawing, if they resize window while drawing it's edge case.
                }
            }
        });

        resizeObserver.observe(imgRef.current);

        return () => resizeObserver.disconnect();
    }, []);

    const handleImgLoad = () => {
        if (imgRef.current && canvasRef.current) {
            canvasRef.current.width = imgRef.current.clientWidth;
            canvasRef.current.height = imgRef.current.clientHeight;
        }
    };

    return (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.8)' }} tabIndex="-1">
            <div className="modal-dialog modal-xl">
                <div className="modal-content bg-dark text-light">
                    <div className="modal-header border-0">
                        <h5 className="modal-title"><i className="fas fa-crop-alt"></i> Setup ROI</h5>
                    </div>
                    <div className="modal-body p-0">
                        {/* Toolbar */}
                        <div className="p-2 border-bottom border-secondary d-flex justify-content-center gap-2">
                            {['rect', 'circle', 'poly', 'freehand'].map(t => {
                                let icon = '';
                                if (t === 'rect') icon = 'fas fa-vector-square';
                                if (t === 'circle') icon = 'far fa-circle';
                                if (t === 'poly') icon = 'fas fa-draw-polygon';
                                if (t === 'freehand') icon = 'fas fa-pen';

                                return (
                                    <button
                                        key={t}
                                        className={`btn btn-dark shape-btn ${tool === t ? 'active' : ''}`}
                                        onClick={() => { setTool(t); clearRoi(); }}
                                        title={t.charAt(0).toUpperCase() + t.slice(1)}
                                    >
                                        <i className={icon}></i>
                                    </button>
                                );
                            })}
                            <button className="btn btn-outline-danger btn-sm" onClick={clearRoi}>Clear</button>
                        </div>

                        <div style={{ background: 'black', minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', maxHeight: '80vh' }}>
                                <img
                                    ref={imgRef}
                                    src={cameraId !== null ? `/video_feed/${cameraId}?t=${feedTimestamp}` : ''}
                                    style={{ display: 'block', maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
                                    onLoad={handleImgLoad}
                                    draggable="false"
                                />
                                <canvas
                                    ref={canvasRef}
                                    style={{ position: 'absolute', top: 0, left: 0, cursor: 'crosshair', zIndex: 50, pointerEvents: 'auto', touchAction: 'none' }}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUp}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer border-0">
                        <button className="btn btn-secondary" onClick={onClose}>Skip / Close</button>
                        <button className="btn btn-primary" onClick={handleSave}>Save ROI</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ROImodal;
