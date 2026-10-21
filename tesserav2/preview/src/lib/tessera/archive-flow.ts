/** Sections of the kept text. The git pack is not a section. Store paths are not drawn. */

export type ArchiveSection = { id: string; label: string; files: number; x: number; y: number; note: string };

export const ARCHIVE_SECTIONS: ArchiveSection[] = [
  { id: "repair", label: "Repair", files: 9425, x: 36, y: 660, note: "9,425 text files under tessera-repair/Gitbook. The 5.8 GB pack is not in this count." },
  { id: "notes", label: "Notes", files: 1629, x: 108, y: 660, note: "1,629 quarantine notes. A symlink was not followed." },
  { id: "tess", label: "Tess", files: 723, x: 180, y: 660, note: "723 files from the tess app tree. One step from that tree: a wait never goes under 1000 ms." },
  { id: "artifacts", label: "Artifacts", files: 140, x: 252, y: 660, note: "140 artifact files." },
  { id: "src", label: "Source", files: 100, x: 324, y: 660, note: "100 source files. Two store-shaped paths in this group were not drawn. One step from that tree: pending, signed in, or signed out." },
  { id: "skills", label: "Skills", files: 85, x: 36, y: 740, note: "85 skill notes." },
  { id: "build", label: "Build", files: 62, x: 108, y: 740, note: "62 build-output files. They are not a program." },
  { id: "packet", label: "Packet", files: 35, x: 180, y: 740, note: "35 packet files. Three store-shaped paths in this group were not drawn." },
  { id: "tools", label: "Tools", files: 47, x: 252, y: 740, note: "27 scripts and 20 library files." },
  { id: "root", label: "Root", files: 30, x: 324, y: 740, note: "30 root notes and small trees." },
];

export function archiveFlow() {
  const files = ARCHIVE_SECTIONS.reduce((sum, section) => sum + section.files, 0);
  return {
    files,
    sections: ARCHIVE_SECTIONS.length,
    pack: "Parts 01 and 02 were the git pack and were not stored.",
    dropped: 8,
  };
}

export function archiveLine() {
  const flow = archiveFlow();
  return `The kept text is ${flow.files} files in ${flow.sections} sections. ${flow.dropped} store-shaped paths were not drawn. ${flow.pack}`;
}

export function archiveEdges() {
  const first = ARCHIVE_SECTIONS[0]?.id ?? "";
  return ARCHIVE_SECTIONS.slice(1).map((section) => [first, section.id] as const);
}
