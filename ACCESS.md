# Diagram Studio — hướng dẫn truy cập & vận hành

## Truy cập từ Mac (LAN)

Harvey remote từ Mac → tool chạy trên `harvey-hermes` @ **192.168.33.200**.

```
http://192.168.33.200:5200/
```

Vite phải bind `0.0.0.0` (đã set trong `vite.config.ts`: `server: {host: '0.0.0.0', ...}`).
Nếu chỉ `localhost` thì Mac KHÔNG vào được.

## Chạy

```bash
cd ~/projects/tech-goblin/lab/diagram-studio
npm install          # lần đầu
npx vite --host 0.0.0.0 --port 5200 --strictPort
```

## Tắt

```bash
for p in $(ss -lntp | grep 5200 | grep -oP 'pid=\K[0-9]+'); do kill $p; done
```
> KHÔNG dùng `pkill -f "vite"` — nó giết luôn shell của chính mình.

## Roadmap (chọn hướng A — build tool riêng)

Giai đoạn sau = automation + animation (Harvey chốt 2026-09-13).

- **Gói 1 — nền tảng chỉnh sửa**: undo/redo, delete, copy/paste/duplicate, snap grid,
  import JSON, export PNG, text node, align/distribute toolbar.
- **Gói 2 (đề xuất)**: shapes đa dạng (ellipse/diamond/container/group), free text trên canvas,
  edge label editing, layers/z-order, templates (pipeline / rebalance / env-ladder).
- **Gói 3 (đề xuất)**: lưu/load từ server (thay vì tải file), thư viện icon thật (thay glyph),
  export SVG "sạch" (không foreignObject — render lại bằng rect/text thuần).
- **Sau này**: automation (sinh diagram từ code/config), animation (chuyển động message).

## Pitfalls đã gặp

- **`localhost` không dùng được từ Mac** → bắt buộc `--host 0.0.0.0`.
- **React Flow Controls mặc định nền sáng** → override `.react-flow__controls-button`.
- **Export SVG qua `foreignObject`** → browser đọc được, Figma/Inkscape thì không.
- **Cắt tab browser khi render/`js()` dài** → không gọi CDP trong lúc render; poll filesystem từ terminal.
