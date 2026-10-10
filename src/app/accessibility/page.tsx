import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = { title: "Accessibility" };

const FEATURES: [string, string][] = [
  ["Display settings", "Use the Accessibility button in the header to enlarge text (up to 125%), switch to high contrast, use an easy-to-read font (Atkinson Hyperlegible, designed for low-vision readers) or reduce animations. Settings are remembered on this device."],
  ["Voice control", "The microphone button lets you search, choose trains and fill in passengers by speaking English, Hindi or Hinglish. You can also type commands, and edit what was heard before it runs. Payment always needs your own click."],
  ["Keyboard", "Every page works with the keyboard alone. Press Tab on any page to reveal a \"Skip to main content\" link; focus is always clearly outlined; station suggestions work with the arrow keys and Enter; Escape closes menus and the voice panel."],
  ["Screen readers", "Pages use headings, landmarks and labelled forms. The current page is announced in the navigation, the number of matching trains is announced when filters change, form errors are linked to their fields, and maps have text descriptions (every stop is also listed in a table)."],
  ["Colour and contrast", "Text meets WCAG 2.2 AA contrast (4.5:1). Seat availability is never shown by colour alone: it is always written out (for example \"38 seats available\" or \"Waitlist #12\")."],
  ["Motion", "Animations are switched off automatically if your device is set to reduce motion, or on request in the display settings."],
];

export default function AccessibilityPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Accessibility</h1>
      <p className="mb-6 text-slate-600">
        {APP_NAME} aims to be usable by everyone, including people who use screen readers, keyboards, magnification or voice.
        We target the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.
      </p>
      <div className="space-y-3">
        {FEATURES.map(([title, body]) => (
          <section key={title} className="card p-4">
            <h2 className="mb-1 font-semibold">{title}</h2>
            <p className="text-sm text-slate-700">{body}</p>
          </section>
        ))}
      </div>
      <p className="mt-6 text-sm text-slate-600">
        Known limitation: the route maps are visual, but every stop shown on a map is also listed in the timetable on the same page.
      </p>
    </div>
  );
}
