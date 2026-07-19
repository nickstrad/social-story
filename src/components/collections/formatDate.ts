const formatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
})

export function formatCollectionDate(value: Date) {
  return formatter.format(value)
}
