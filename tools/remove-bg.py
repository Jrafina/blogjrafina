"""
批量抠图：把有背景的图片抠成透明背景 PNG（动漫角色专用模型）

用法:
    python remove-bg.py <输入文件夹> [输出文件夹]

示例:
    python remove-bg.py raw out          # raw 里的图 → out/xxx_bg.png
    python remove-bg.py "我的图片" 抠图结果

安装依赖（首次运行还会自动下载模型，约 170MB）:
    pip install rembg[cpu]

模型说明:
    isnet-anime       动漫插画专用，抠动漫角色效果最好（默认）
    isnet-general-use 通用物体，人物照片也可以用
    （改下面的 MODEL 变量即可）
"""
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

MODEL = "isnet-anime"

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    src_dir = Path(sys.argv[1])
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else src_dir / "out"
    out_dir.mkdir(parents=True, exist_ok=True)

    exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
    files = [p for p in src_dir.iterdir() if p.is_file() and p.suffix.lower() in exts]
    if not files:
        print(f"没有找到图片: {src_dir}")
        sys.exit(1)

    from rembg import remove, new_session

    print(f"加载模型 {MODEL}（首次运行会自动下载）...")
    session = new_session(MODEL)

    done = skipped = 0
    for p in files:
        out_path = out_dir / (p.stem + "_bg.png")
        if out_path.exists():
            print(f"跳过（已存在）: {out_path.name}")
            skipped += 1
            continue
        print(f"处理: {p.name} ...", end="", flush=True)
        try:
            out_data = remove(p.read_bytes(), session=session)
        except Exception as e:
            print(f"\n  失败: {e}")
            continue
        out_path.write_bytes(out_data)
        print(f" 完成 -> {out_path.name}")
        done += 1

    print(f"\n完成 {done} 张，跳过 {skipped} 张，输出目录: {out_dir}")
    print("把抠好的 PNG 传到图床，再把链接填进 js/mascot.js 的 CFG.images 即可")

if __name__ == "__main__":
    main()
