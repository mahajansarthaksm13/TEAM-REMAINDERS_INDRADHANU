import { test } from "node:test"
import assert from "node:assert/strict"
import { timeAgo } from "../lib/format.ts"

const now = Date.parse("2026-11-08T12:00:00Z")
const ago = (ms) => new Date(now - ms).toISOString()

test("timeAgo never rounds up into the next unit", () => {
  assert.equal(timeAgo(ago(119_000), now), "1 min ago") // 1 min 59 s
  assert.equal(timeAgo(ago(3_590_000), now), "59 min ago") // 59 min 50 s, not "60 min ago"
  assert.equal(timeAgo(ago(86_000_000), now), "23 h ago") // 23 h 53 min, not "24 h ago"
})

test("timeAgo crosses units exactly at the boundary", () => {
  assert.equal(timeAgo(ago(59_000), now), "59s ago")
  assert.equal(timeAgo(ago(60_000), now), "1 min ago")
  assert.equal(timeAgo(ago(3_600_000), now), "1 h ago")
  assert.equal(timeAgo(ago(86_400_000), now), "1 d ago")
})

test("timeAgo treats future timestamps (clock skew) as now", () => {
  assert.equal(timeAgo(new Date(now + 5_000).toISOString(), now), "0s ago")
})
