// FIXME: 테스트용
export const mapToTree = (data: Record<string, any>[]) => {
  // 1. 데이터를 value=code, label=codename으로 매핑
  const mappedData = data.map((item) => ({
    value: item.code,
    label: item.codename,
    refcode1: item.refcode1,
    children: [],
  }))

  // 2. refcode1 데이터가 있는 경우 children 속성 추가
  mappedData.forEach((item) => {
    if (item.refcode1) {
      // refcode1에서 코드를 추출
      const refcode1Key = item.refcode1.match(/\[([A-Z0-9]+)\]/)

      if (refcode1Key) {
        const childCode = refcode1Key[1] // 추출된 코드
        const child = mappedData.find((i) => i.value === childCode)
        if (child) {
          item.children.push(child)
        }
      }
    }
  })

  return mappedData
}
