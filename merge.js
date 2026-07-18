/*
 * Second Memory — pure merge logic, deliberately dependency-free (no DOM,
 * no network, no IndexedDB) so it can be unit-tested directly in
 * tests.html and reasoned about in isolation.
 *
 * Conflict rule (per product decision): a tombstone (deletedAt set)
 * ALWAYS wins over a live record for the same id, regardless of which
 * one has the newer updatedAt. Deletes are terminal — an edit made on
 * another device after a delete is lost, which is the accepted trade-off
 * for a single-user app where resurrecting an item with missing Drive
 * media would be worse.
 * Among two records that are both tombstoned or both live, the newer
 * updatedAt wins.
 */

/** Resolve the winner between two versions of the same record. Either may be undefined. */
export function resolveRecord(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.deletedAt && !b.deletedAt) return a;
  if (b.deletedAt && !a.deletedAt) return b;
  return (a.updatedAt || "") >= (b.updatedAt || "") ? a : b;
}

/**
 * Merge two full item collections (arrays of records) by id.
 * Returns { merged: Record[], stats: { added, updated, deleted } } where
 * the stats describe the effect on the LOCAL collection (i.e. what a
 * user would be told happened to their device after this sync).
 */
export function mergeItemSets(localItems, remoteItems) {
  const localMap = new Map(localItems.map((i) => [i.id, i]));
  const remoteMap = new Map(remoteItems.map((i) => [i.id, i]));
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()]);

  const merged = [];
  let added = 0, updated = 0, deleted = 0;

  for (const id of allIds) {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);
    const winner = resolveRecord(local, remote);
    merged.push(winner);

    if (!local && remote) {
      if (winner.deletedAt) deleted++; else added++;
    } else if (local && remote && winner !== local) {
      if (winner.deletedAt && !local.deletedAt) deleted++;
      else if (!winner.deletedAt) updated++;
    }
    // local-only records (not in remote) are unchanged locally; they get
    // uploaded to remote by the caller, but that's not a local-facing stat.
  }

  return { merged, stats: { added, updated, deleted } };
}

/**
 * Decide which media blobs need uploading, downloading, or local deletion
 * after items have been merged.
 * localMediaIds: Set<mediaId> of media blobs present in the local media store.
 * remoteMediaNames: Set<string> of "<itemId>__<filename>" present in the Drive folder.
 */
export function computeMediaActions(mergedItems, localMediaIds, remoteMediaNames) {
  const toUpload = [];
  const toDownload = [];
  const toDeleteLocal = [];

  const tombstonedIds = new Set();
  for (const item of mergedItems) {
    if (item.deletedAt) tombstonedIds.add(item.id);
    if (!item.mediaId) continue;
    const remoteName = `${item.id}__${item.filename}`;
    const remoteHas = remoteMediaNames.has(remoteName);
    const localHas = localMediaIds.has(item.mediaId);

    if (item.deletedAt) {
      if (localHas) toDeleteLocal.push(item);
      continue;
    }
    if (localHas && !remoteHas) toUpload.push(item);
    if (!localHas && remoteHas) toDownload.push({ item, remoteName });
  }

  // Remove Drive media belonging to a deleted item, matched by the "<id>__"
  // filename prefix. This runs independently of whether the LOCAL blob still
  // exists — deletion purges the local blob within seconds (undo-expire), so
  // by the next sync it's usually gone, and gating remote deletion on the
  // local blob would orphan the Drive copy forever. Matching by id (not the
  // exact filename) also lets "delete forever" wipe the filename and still
  // have the Drive copy cleaned here.
  const toDeleteRemoteNames = [];
  for (const name of remoteMediaNames) {
    const id = name.split("__")[0];
    if (tombstonedIds.has(id)) toDeleteRemoteNames.push(name);
  }

  return { toUpload, toDownload, toDeleteLocal, toDeleteRemoteNames };
}
