import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

type Step = {
    targetId: string;
    title: string;
    content: string;
    position: 'top' | 'bottom' | 'left' | 'right';
    action?: () => void;
};

const STEPS: Step[] = [
    {
        targetId: 'sidebar-directory-tree',
        title: '浏览目录',
        content: '这里列出了所有的 HTML 页面和文件夹。点击文件夹展开，点击文件预览。',
        position: 'right',
    },
    {
        targetId: 'prompt-panel-card',
        title: '获取 Prompt',
        content: '每个目录都有专属的 System Prompt。点击这里复制，准备去生成代码。',
        position: 'bottom',
    },
    {
        targetId: 'ai-dock-container',
        title: 'AI 创作',
        content: '点击底部的 AI 图标，跳转到你喜欢的 AI 平台。粘贴刚才复制的 Prompt 开始创作。',
        position: 'top',
    },
    {
        targetId: 'btn-create-page',
        title: '新建页面',
        content: '创作完成后，点击这里新建页面，把 AI 生成的代码粘贴进来。',
        position: 'bottom',
    },
];

const UserGuide = () => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        const hasSeenGuide = localStorage.getItem('has_seen_user_guide');
        if (!hasSeenGuide) {
            // 延迟一点显示，确保 DOM 渲染完成
            setTimeout(() => setIsVisible(true), 1000);
        }
    }, []);

    const updatePosition = useCallback(() => {
        if (!isVisible) return;
        const step = STEPS[currentStepIndex];
        const element = document.getElementById(step.targetId);
        if (element) {
            setTargetRect(element.getBoundingClientRect());
            // 如果元素不在视口内，滚动到元素
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // 如果找不到元素（可能被折叠），跳过或保持
            console.warn(`Target element ${step.targetId} not found`);
        }
    }, [currentStepIndex, isVisible]);

    useEffect(() => {
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [updatePosition]);

    const handleNext = () => {
        if (currentStepIndex < STEPS.length - 1) {
            setCurrentStepIndex((prev) => prev + 1);
        } else {
            handleClose();
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex((prev) => prev - 1);
        }
    };

    const handleClose = () => {
        setIsVisible(false);
        localStorage.setItem('has_seen_user_guide', 'true');
    };

    if (!isVisible || !targetRect) return null;

    const step = STEPS[currentStepIndex];

    // 计算 Tooltip 位置
    let top = 0;
    let left = 0;
    const tooltipWidth = 320;
    const gap = 16;

    switch (step.position) {
        case 'right':
            top = targetRect.top + targetRect.height / 2 - 100; // 稍微向上偏移
            left = targetRect.right + gap;
            break;
        case 'left':
            top = targetRect.top + targetRect.height / 2 - 100;
            left = targetRect.left - tooltipWidth - gap;
            break;
        case 'bottom':
            top = targetRect.bottom + gap;
            left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
            break;
        case 'top':
            top = targetRect.top - 200 - gap; // 预估高度
            left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
            break;
    }

    // 边界检查，防止溢出屏幕
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) left = window.innerWidth - tooltipWidth - 10;
    if (top < 10) top = 10;

    return createPortal(
        <div className="user-guide-overlay">
            {/* 高亮遮罩 - 使用 box-shadow 实现镂空效果 */}
            <div
                className="guide-highlight"
                style={{
                    top: targetRect.top,
                    left: targetRect.left,
                    width: targetRect.width,
                    height: targetRect.height,
                }}
            />

            {/* 提示框 */}
            <div
                className={`guide-tooltip ${step.position}`}
                style={{
                    top,
                    left,
                    width: tooltipWidth,
                }}
            >
                <button className="guide-close" onClick={handleClose}>
                    <X size={16} />
                </button>
                <div className="guide-content">
                    <h3>
                        <span className="step-badge">{currentStepIndex + 1}</span>
                        {step.title}
                    </h3>
                    <p>{step.content}</p>
                </div>
                <div className="guide-footer">
                    <div className="guide-dots">
                        {STEPS.map((_, idx) => (
                            <span key={idx} className={`dot ${idx === currentStepIndex ? 'active' : ''}`} />
                        ))}
                    </div>
                    <div className="guide-actions">
                        {currentStepIndex > 0 && (
                            <button className="btn-secondary-sm" onClick={handlePrev}>
                                <ChevronLeft size={14} /> 上一步
                            </button>
                        )}
                        <button className="btn-primary-sm" onClick={handleNext}>
                            {currentStepIndex === STEPS.length - 1 ? '开始使用' : '下一步'}
                            {currentStepIndex < STEPS.length - 1 && <ChevronRight size={14} />}
                        </button>
                    </div>
                </div>
                {/* 箭头 */}
                <div className="guide-arrow-pointer" />
            </div>
        </div>,
        document.body
    );
};

export default UserGuide;
