/**
 * Group / cluster helpers for connected jigsaw pieces (pure).
 * Each piece starts alone; snapping merges groups and translates members.
 */

export function createGroups(pieceCount) {
  const groupOf = new Array(pieceCount);
  const members = new Map();
  for (let id = 0; id < pieceCount; id += 1) {
    groupOf[id] = id;
    members.set(id, new Set([id]));
  }
  return { groupOf, members };
}

export function groupIdOf(groups, pieceId) {
  return groups.groupOf[pieceId];
}

export function membersOf(groups, pieceId) {
  const gid = groups.groupOf[pieceId];
  return groups.members.get(gid);
}

export function groupCount(groups) {
  return groups.members.size;
}

/**
 * Translate every piece in `pieceId`'s group by (dx, dy).
 * `positions` is an array of `{ x, y }` indexed by piece id.
 */
export function translateGroup(groups, positions, pieceId, dx, dy) {
  const members = membersOf(groups, pieceId);
  for (const id of members) {
    positions[id].x += dx;
    positions[id].y += dy;
  }
}

/**
 * Merge the group containing `fromId` into the group containing `intoId`.
 * Applies `dx, dy` to `fromId`'s group first so geometry lines up.
 */
export function mergeGroups(groups, positions, fromId, intoId, dx, dy) {
  const fromG = groups.groupOf[fromId];
  const intoG = groups.groupOf[intoId];
  if (fromG === intoG) return false;

  translateGroup(groups, positions, fromId, dx, dy);

  const fromMembers = groups.members.get(fromG);
  const intoMembers = groups.members.get(intoG);
  for (const id of fromMembers) {
    groups.groupOf[id] = intoG;
    intoMembers.add(id);
  }
  groups.members.delete(fromG);
  return true;
}

/**
 * Detach a piece into its own singleton group.
 * No-op when the piece is already alone.
 */
export function detachPiece(groups, pieceId) {
  const gid = groups.groupOf[pieceId];
  const members = groups.members.get(gid);
  if (!members) {
    groups.groupOf[pieceId] = pieceId;
    groups.members.set(pieceId, new Set([pieceId]));
    return;
  }
  if (members.size === 1 && members.has(pieceId)) return;

  members.delete(pieceId);
  if (members.size === 0) groups.members.delete(gid);

  groups.groupOf[pieceId] = pieceId;
  groups.members.set(pieceId, new Set([pieceId]));
}

/**
 * Detach every listed piece into its own singleton group.
 * @param {Iterable<number>} pieceIds
 */
export function detachPieces(groups, pieceIds) {
  for (const id of pieceIds) detachPiece(groups, id);
}

/** True when every piece shares a single group. */
export function isFullyAssembled(groups, pieceCount) {
  return pieceCount > 0 && groupCount(groups) === 1;
}
