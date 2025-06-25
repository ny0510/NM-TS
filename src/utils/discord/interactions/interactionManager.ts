const processedInteractions = new Set<string>();

/**
 * 인터랙션을 처리됨으로 표시
 * @param interactionId 인터랙션 ID
 */
export function markInteractionProcessed(interactionId: string): void {
  processedInteractions.add(interactionId);
  // 5분 후 자동 제거
  setTimeout(() => processedInteractions.delete(interactionId), 5 * 60 * 1000);
}

/**
 * 인터랙션이 이미 처리되었는지 확인
 * @param interactionId 인터랙션 ID
 * @returns 처리되었으면 true, 아니면 false
 */
export function isInteractionProcessed(interactionId: string): boolean {
  return processedInteractions.has(interactionId);
}

/**
 * 안전하게 인터랙션 처리 여부를 확인하고 마킹
 * @param interactionId 인터랙션 ID
 * @returns 이미 처리되었으면 true, 처리 가능하면 false
 */
export function checkAndMarkInteraction(interactionId: string): boolean {
  if (isInteractionProcessed(interactionId)) {
    return true;
  }
  markInteractionProcessed(interactionId);
  return false;
}

/**
 * 처리된 인터랙션 수 반환 (디버깅용)
 */
export function getProcessedInteractionCount(): number {
  return processedInteractions.size;
}
