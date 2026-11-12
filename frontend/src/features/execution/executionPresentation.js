export function countRecordedOperations(operations) {
  return operations.filter((operation) => operation.actual_spent !== null)
    .length
}
