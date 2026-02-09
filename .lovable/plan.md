

# Sắp xếp lại ô nhập tin nhắn theo kiểu Telegram

## Mô tả

Bố trí lại các nút trong ô nhập tin nhắn gọn gàng hơn, lấy cảm hứng từ Telegram:

**Bố cục mới:**
```text
[Kẹp giấy (Paperclip)] [______Ô nhập tin nhắn______] [Emoji] [Gửi]
```

- **Bên trái**: 1 nút Kẹp giấy (Paperclip) duy nhất. Click vào sẽ popup menu chứa các tùy chọn:
  - Ảnh/Video (file picker)
  - Ghi âm (voice recorder)
  - Ví / Gửi tiền (Crypto)
  - Lì xì (Red Envelope - chỉ nhóm)
  - Mẫu tin nhắn (Templates)
  - Đặt lịch gửi (Schedule)
  - Sticker

- **Bên phải** (trong ô input): Icon Emoji (Smile) + nút Gửi (Send)

## Thay đổi so với hiện tại

| Hiện tại | Mới (kiểu Telegram) |
|----------|---------------------|
| 7-8 icon rời rạc bên trái ô input | 1 icon Paperclip duy nhất bên trái |
| Emoji nằm bên trái | Emoji nằm bên phải, cạnh nút Gửi |
| Clock + Send nằm trong ô input | Chỉ Emoji + Send bên phải |
| Rất nhiều nút, khó dùng trên mobile | Gọn gàng, 1 nút popup menu |

## Chi tiết kỹ thuật

### File cần sửa: `src/components/chat/ChatWindow.tsx`

**Vùng input (dòng 963-1143) sẽ được tổ chức lại:**

1. Xóa tất cả các nút riêng lẻ (Sticker, FileText, Smile, Paperclip, Mic, Coins, Gift) khỏi khu vực bên trái

2. Thay bằng 1 DropdownMenu với trigger là icon Paperclip:
   - Menu item: "Ảnh / Video" -> trigger file picker
   - Menu item: "Ghi âm" -> start recording
   - Menu item: "Sticker" -> mở sticker picker
   - Menu item: "Mẫu tin nhắn" -> mở templates menu
   - Menu item: "Gửi tiền" -> mở crypto dialog
   - Menu item: "Lì xì" (chỉ group) -> mở red envelope dialog
   - Menu item: "Đặt lịch gửi" -> mở schedule dialog

3. Bên phải ô input (absolute positioned): Emoji button + Send button

4. Xóa dòng "Tối đa 4 file mỗi tin nhắn"

### Cấu trúc JSX mới:

```text
<div className="flex items-center gap-2">
  <!-- Paperclip dropdown menu (bên trái) -->
  <DropdownMenu>
    <DropdownMenuTrigger>
      <Paperclip icon />
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      ...các menu items...
    </DropdownMenuContent>
  </DropdownMenu>

  <!-- Ô input (flex-1) -->
  <div className="flex-1 relative">
    <Textarea ... />
    <!-- Absolute right: Emoji + Send -->
    <div className="absolute right-1 top-1/2">
      <Smile button />
      <Send button />
    </div>
  </div>
</div>
```

### Lưu ý
- StickerPicker component sẽ vẫn giữ nguyên logic, chỉ trigger mở từ menu item thay vì button riêng
- TemplatesMenu popup vẫn giữ nguyên, chỉ trigger từ menu
- Tất cả state và logic hiện tại không thay đổi, chỉ sắp xếp lại UI

