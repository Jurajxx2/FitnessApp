import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts"
import { mondayOf, usersNeedingReminder } from "./reminder.ts"

Deno.test("mondayOf returns Monday for a mid-week date", () => {
  // 2026-07-08 is a Wednesday -> Monday 2026-07-06
  assertEquals(mondayOf(new Date("2026-07-08T12:00:00Z")), "2026-07-06")
})

Deno.test("mondayOf returns same day for a Monday", () => {
  assertEquals(mondayOf(new Date("2026-07-06T00:00:00Z")), "2026-07-06")
})

Deno.test("mondayOf handles Sunday as end of week", () => {
  // 2026-07-12 is a Sunday -> Monday 2026-07-06
  assertEquals(mondayOf(new Date("2026-07-12T23:00:00Z")), "2026-07-06")
})

Deno.test("mondayOf handles Saturday", () => {
  // 2026-07-11 is a Saturday -> Monday 2026-07-06
  assertEquals(mondayOf(new Date("2026-07-11T00:00:00Z")), "2026-07-06")
})

Deno.test("usersNeedingReminder excludes users who checked in", () => {
  const trainees = [{ id: "a" }, { id: "b" }, { id: "c" }]
  const checkedIn = new Set(["b"])
  assertEquals(usersNeedingReminder(trainees, checkedIn), ["a", "c"])
})

Deno.test("usersNeedingReminder returns empty when all checked in", () => {
  const trainees = [{ id: "a" }]
  assertEquals(usersNeedingReminder(trainees, new Set(["a"])), [])
})
