import { firstLiked, primaryCount, shareOfLibrary } from './presentation.ts'
import type { ArtistRanking, Library } from './types.ts'

export interface ExportRow {
  id: string
  rank: number
  name: string
  count: number
  /** Bar length against the leader, as a percentage. */
  barPercent: number
}

/** Rows the shared image draws: a square holds twenty, whatever the library's size. */
const IMAGE_ROWS = 20

const CSV_HEADER = ['Rank', 'Artist', 'Liked songs', 'Share of library', 'As primary', 'First liked']
/** Spreadsheets read UTF-8 only when the file says so, and without it accented names arrive as mojibake. */
const BOM = '﻿'

function csvField(value: string | number): string {
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** The current view as comma-separated text: the same figures the app shows, one row per artist. */
export function toCsv(rankings: readonly ArtistRanking[], trackCount: number): string {
  const lines = [CSV_HEADER.join(',')]
  for (const ranking of rankings) {
    lines.push(
      [
        ranking.rank,
        csvField(ranking.artist.name),
        ranking.count,
        `${(shareOfLibrary(ranking.count, trackCount) * 100).toFixed(1)}%`,
        primaryCount(ranking.artist.id, ranking.tracks),
        firstLiked(ranking.tracks) ?? '',
      ].join(','),
    )
  }
  return BOM + lines.join('\r\n') + '\r\n'
}

/** `listenprint-top-artists-2026-09-17.png`, with `sample-` in front for the demo library. */
export function exportFileName(kind: 'csv' | 'png', source: Library['source'], now: Date): string {
  const date = now.toISOString().slice(0, 10)
  return `${source === 'demo' ? 'sample-' : ''}listenprint-top-artists-${date}.${kind}`
}

export function exportRows(rankings: readonly ArtistRanking[]): ExportRow[] {
  const leaderCount = rankings.at(0)?.count ?? 0
  return rankings.slice(0, IMAGE_ROWS).map((ranking) => ({
    id: ranking.artist.id,
    rank: ranking.rank,
    name: ranking.artist.name,
    count: ranking.count,
    barPercent: Math.round((ranking.count / leaderCount) * 100),
  }))
}
