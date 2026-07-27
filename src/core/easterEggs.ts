/** Content written only by NPSharp's explicit new-file flow. */
export const GTA6_EASTER_EGG_FILE_NAME = "gta6.py";

export const GTA6_EASTER_EGG_CONTENT = `game = "GTA 6"
code_difficulty = "senior"
graphics = "better than reality"
bugs = False
optimization = "maximum"
controls = ["W", "A", "S", "D", "SPACE"]

hackers = True

if hackers:
    print("bimbimbambam")
    hackers = False

print("GTA 6 implementado antes da Rockstar.")
`;

/** Deliberately called only while NPSharp is creating a brand-new file. */
export function initialContentForNewNPSharpFile(name: string): string {
  return name === GTA6_EASTER_EGG_FILE_NAME ? GTA6_EASTER_EGG_CONTENT : "";
}
