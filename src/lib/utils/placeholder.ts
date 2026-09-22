// Теплі градієнти відтінків дерева для плейсхолдерів фото (см. спек §3);
// варіюються за id закладу, щоб сітка не виглядала монотонною
const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(135deg,#4a3b28,#2c241c)',
  'linear-gradient(135deg,#5a4426,#332617)',
  'linear-gradient(135deg,#6b4a2a,#3d2a18)',
  'linear-gradient(135deg,#584032,#2f231a)',
]

export function placeholderFor(id: string): string {
  const h = [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return PLACEHOLDER_GRADIENTS[h % PLACEHOLDER_GRADIENTS.length]
}
