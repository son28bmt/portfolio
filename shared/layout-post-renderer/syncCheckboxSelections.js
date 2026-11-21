export function syncCheckboxSelections(options = [], selections = [], allowMultiple = true) {
  const previous = new Map((Array.isArray(selections) ? selections : []).map((item) => [String(item?.label || '').trim(), Boolean(item?.checked)]));
  let checkedFound = false;
  return [...new Set(options.map((item) => String(item || '').trim()).filter(Boolean))].map((label) => {
    const checked = allowMultiple ? Boolean(previous.get(label)) : Boolean(previous.get(label)) && !checkedFound;
    if (checked) checkedFound = true;
    return { label, checked };
  });
}