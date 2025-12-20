#!/usr/bin/env python3
"""
高效视频压缩脚本 - 使用本机 FFmpeg + 硬件加速

目标: 快速压缩到 1/10 大小

用法:
    python compress_video.py input.mp4 [选项]
    python compress_video.py input.mp4 --fast          # 快速模式 (推荐)
    python compress_video.py input.mp4 --fast --tiny   # 极限压缩
"""

import subprocess
import argparse
import os
import sys
import time
from pathlib import Path


def get_video_info(input_file: str) -> dict:
    """获取视频基本信息"""
    cmd = [
        'ffprobe', '-v', 'quiet',
        '-print_format', 'json',
        '-show_format', '-show_streams',
        input_file
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        import json
        data = json.loads(result.stdout)
        
        video_stream = next((s for s in data['streams'] if s['codec_type'] == 'video'), None)
        
        if video_stream:
            fps_str = video_stream.get('r_frame_rate', '30/1')
            try:
                fps = eval(fps_str)
            except:
                fps = 30
                
            return {
                'width': int(video_stream.get('width', 0)),
                'height': int(video_stream.get('height', 0)),
                'duration': float(data['format'].get('duration', 0)),
                'size': int(data['format'].get('size', 0)),
                'fps': fps,
                'codec': video_stream.get('codec_name', 'unknown')
            }
    except Exception as e:
        print(f"警告: 无法获取视频信息: {e}")
    
    return {}


def format_size(bytes_size: int) -> str:
    """格式化文件大小"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024:
            return f"{bytes_size:.1f} {unit}"
        bytes_size /= 1024
    return f"{bytes_size:.1f} TB"


def check_hw_support() -> str:
    """检测 Mac 硬件加速支持"""
    # 检查 VideoToolbox (Mac 硬件编码)
    try:
        result = subprocess.run(
            ['ffmpeg', '-hide_banner', '-encoders'],
            capture_output=True, text=True
        )
        if 'h264_videotoolbox' in result.stdout:
            return 'videotoolbox'
    except:
        pass
    return 'software'


def build_fast_command(
    input_file: str,
    output_file: str,
    target_height: int = 720,
    target_fps: int = 15,
    quality: str = 'medium',
    use_hw: bool = True,
    output_format: str = 'mp4',
    start_time: float = None,
    end_time: float = None
) -> list:
    """构建高效压缩命令"""
    
    cmd = ['ffmpeg', '-y']
    
    # 硬件解码 (如果是 HEVC/H.265)
    # cmd.extend(['-hwaccel', 'videotoolbox'])  # 可选
    
    # 时间裁剪 (放在输入前可以加速)
    if start_time is not None:
        cmd.extend(['-ss', str(start_time)])
    
    cmd.extend(['-i', input_file])
    
    if end_time is not None:
        duration = end_time - (start_time or 0)
        cmd.extend(['-t', str(duration)])
    
    # 视频滤镜: 缩放 + 降帧率
    filters = []
    filters.append(f'scale=-2:{target_height}')  # -2 保证宽度是偶数
    filters.append(f'fps={target_fps}')
    cmd.extend(['-vf', ','.join(filters)])
    
    # 编码设置
    if output_format == 'mp4':
        if use_hw:
            # Mac 硬件编码 H.264 (非常快!)
            cmd.extend(['-c:v', 'h264_videotoolbox'])
            
            # 质量控制 (videotoolbox 用 bitrate 或 quality)
            quality_bitrates = {
                'high': '2M',
                'medium': '1M',
                'low': '500k',
                'ultra-low': '250k'
            }
            cmd.extend(['-b:v', quality_bitrates.get(quality, '1M')])
        else:
            # 软件编码 H.264
            cmd.extend(['-c:v', 'libx264'])
            cmd.extend(['-preset', 'veryfast'])  # 快速预设
            
            quality_crf = {
                'high': '23',
                'medium': '28',
                'low': '35',
                'ultra-low': '42'
            }
            cmd.extend(['-crf', quality_crf.get(quality, '28')])
        
        # 音频
        cmd.extend(['-c:a', 'aac', '-b:a', '64k'])  # 低码率音频
        
    elif output_format == 'webm':
        # VP9 编码 (比 WebP 快很多)
        cmd.extend(['-c:v', 'libvpx-vp9'])
        cmd.extend(['-deadline', 'realtime'])  # 最快模式
        cmd.extend(['-cpu-used', '8'])  # 最快 CPU 使用
        
        quality_crf = {
            'high': '30',
            'medium': '40',
            'low': '50',
            'ultra-low': '55'
        }
        cmd.extend(['-crf', quality_crf.get(quality, '40')])
        cmd.extend(['-b:v', '0'])
        cmd.extend(['-c:a', 'libopus', '-b:a', '48k'])
        
    elif output_format == 'gif':
        # GIF (小文件，适合短片段)
        # 先生成调色板再转 GIF
        cmd = ['ffmpeg', '-y']
        if start_time:
            cmd.extend(['-ss', str(start_time)])
        cmd.extend(['-i', input_file])
        if end_time:
            cmd.extend(['-t', str(end_time - (start_time or 0))])
        
        # 使用更高效的 GIF 编码
        cmd.extend([
            '-vf', f'fps={target_fps},scale=-2:{target_height}:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer',
            '-loop', '0'
        ])
    
    cmd.append(output_file)
    return cmd


def compress_video(
    input_file: str,
    output_file: str = None,
    mode: str = 'fast',  # fast, tiny, quality
    output_format: str = 'mp4',
    resolution: int = None,
    fps: int = None,
    quality: str = None,
    start_time: float = None,
    end_time: float = None,
    preview_only: bool = False,
    no_hw: bool = False
) -> bool:
    """执行视频压缩"""
    
    # 验证输入文件
    if not os.path.exists(input_file):
        print(f"错误: 输入文件不存在: {input_file}")
        return False
    
    # 获取原始视频信息
    info = get_video_info(input_file)
    if not info:
        print("错误: 无法读取视频信息")
        return False
    
    print(f"\n📹 原始视频信息:")
    print(f"   分辨率: {info['width']}x{info['height']}")
    print(f"   时长: {info['duration']:.1f}s")
    print(f"   帧率: {info['fps']:.1f} fps")
    print(f"   大小: {format_size(info['size'])}")
    print(f"   编码: {info['codec']}")
    
    # 检测硬件支持
    hw_type = 'none' if no_hw else check_hw_support()
    if hw_type == 'videotoolbox':
        print(f"   🚀 硬件加速: VideoToolbox (Mac GPU)")
    else:
        print(f"   💻 编码模式: 软件编码")
    
    # 根据模式设置参数
    if mode == 'fast':
        # 快速模式: 720p, 15fps, medium 质量
        target_height = resolution or 720
        target_fps = fps or 15
        target_quality = quality or 'medium'
    elif mode == 'tiny':
        # 极限压缩: 480p, 10fps, low 质量
        target_height = resolution or 480
        target_fps = fps or 10
        target_quality = quality or 'low'
    elif mode == 'quality':
        # 质量优先: 原分辨率, 24fps
        target_height = resolution or min(info['height'], 1080)
        target_fps = fps or 24
        target_quality = quality or 'high'
    else:
        # 自定义
        target_height = resolution or 720
        target_fps = fps or 15
        target_quality = quality or 'medium'
    
    print(f"\n⚙️  压缩设置:")
    print(f"   目标分辨率: {target_height}p")
    print(f"   目标帧率: {target_fps} fps")
    print(f"   质量等级: {target_quality}")
    print(f"   输出格式: {output_format}")
    
    # 预估压缩比
    original_pixels = info['width'] * info['height'] * info['fps']
    target_pixels = (target_height * 16 / 9) * target_height * target_fps
    pixel_ratio = original_pixels / target_pixels if target_pixels > 0 else 1
    
    quality_factor = {'high': 2, 'medium': 5, 'low': 10, 'ultra-low': 20}.get(target_quality, 5)
    estimated_ratio = pixel_ratio * quality_factor / 5
    estimated_size = info['size'] / estimated_ratio
    
    print(f"   预估压缩比: ~1/{estimated_ratio:.0f}")
    print(f"   预估大小: ~{format_size(int(estimated_size))}")
    
    # 生成输出文件名
    if output_file is None:
        input_path = Path(input_file)
        output_file = str(input_path.parent / f"{input_path.stem}_{mode}.{output_format}")
    
    # 构建命令
    cmd = build_fast_command(
        input_file=input_file,
        output_file=output_file,
        target_height=target_height,
        target_fps=target_fps,
        quality=target_quality,
        use_hw=(hw_type == 'videotoolbox' and output_format == 'mp4'),
        output_format=output_format,
        start_time=start_time,
        end_time=end_time
    )
    
    print(f"\n🔧 FFmpeg 命令:")
    print(f"   {' '.join(cmd)}\n")
    
    if preview_only:
        print("⏸️  预览模式，未执行压缩")
        return True
    
    # 执行压缩
    print("⏳ 正在压缩...")
    start = time.time()
    
    try:
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True
        )
        
        for line in process.stdout:
            if 'time=' in line or 'frame=' in line:
                # 提取速度信息
                parts = line.strip().split()
                speed_part = [p for p in parts if 'speed=' in p]
                speed = speed_part[0].replace('speed=', '') if speed_part else ''
                print(f"\r   进度: {line.strip()[:80]}", end='', flush=True)
        
        process.wait()
        elapsed = time.time() - start
        
        if process.returncode == 0 and os.path.exists(output_file):
            output_size = os.path.getsize(output_file)
            ratio = info['size'] / output_size if output_size > 0 else 1
            
            print(f"\n\n✅ 压缩完成! 耗时 {elapsed:.1f}s")
            print(f"   输出文件: {output_file}")
            print(f"   输出大小: {format_size(output_size)}")
            print(f"   实际压缩比: 1/{ratio:.1f} (减少 {(1 - 1/ratio) * 100:.0f}%)")
            print(f"   处理速度: {info['duration'] / elapsed:.1f}x 实时")
            return True
        else:
            print(f"\n❌ 压缩失败，返回码: {process.returncode}")
            return False
            
    except Exception as e:
        print(f"\n❌ 压缩出错: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='高效视频压缩 - Mac 硬件加速',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
模式说明:
  --fast   快速模式: 720p, 15fps, 中等质量 (推荐，约 1/10 压缩)
  --tiny   极限模式: 480p, 10fps, 低质量 (约 1/20+ 压缩)
  --quality 质量模式: 1080p, 24fps, 高质量 (约 1/5 压缩)

示例:
  python compress_video.py video.mp4 --fast              # 快速压缩到 ~1/10
  python compress_video.py video.mp4 --tiny              # 极限压缩
  python compress_video.py video.mp4 --fast -f webm      # 输出 WebM 格式
  python compress_video.py video.mp4 --resolution 360    # 自定义分辨率
        """
    )
    
    parser.add_argument('input', help='输入视频文件路径')
    parser.add_argument('-o', '--output', help='输出文件路径')
    parser.add_argument('-f', '--format', choices=['mp4', 'webm', 'gif'], 
                        default='mp4', help='输出格式 (默认: mp4)')
    
    # 模式选择
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument('--fast', action='store_true', help='快速模式 (720p, 15fps)')
    mode_group.add_argument('--tiny', action='store_true', help='极限压缩 (480p, 10fps)')
    mode_group.add_argument('--quality', action='store_true', help='质量优先 (1080p, 24fps)')
    
    # 自定义参数
    parser.add_argument('--resolution', type=int, help='目标高度 (如 720, 480, 360)')
    parser.add_argument('--fps', type=int, help='目标帧率 (如 24, 15, 10)')
    parser.add_argument('-q', '--quality-level', choices=['high', 'medium', 'low', 'ultra-low'],
                        help='质量等级')
    
    parser.add_argument('--start', type=float, help='起始时间 (秒)')
    parser.add_argument('--end', type=float, help='结束时间 (秒)')
    parser.add_argument('--no-hw', action='store_true', help='禁用硬件加速')
    parser.add_argument('--preview', action='store_true', help='仅预览命令')
    
    args = parser.parse_args()
    
    # 确定模式
    if args.fast:
        mode = 'fast'
    elif args.tiny:
        mode = 'tiny'
    elif args.quality:
        mode = 'quality'
    else:
        mode = 'fast'  # 默认快速模式
    
    success = compress_video(
        input_file=args.input,
        output_file=args.output,
        mode=mode,
        output_format=args.format,
        resolution=args.resolution,
        fps=args.fps,
        quality=args.quality_level,
        start_time=args.start,
        end_time=args.end,
        preview_only=args.preview,
        no_hw=args.no_hw
    )
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
