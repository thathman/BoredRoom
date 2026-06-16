export function BuiltByFooter() {
  return (
    <footer className="mt-8 text-center text-sm text-muted-foreground">
      built with <span aria-label="love">♥</span> by{" "}
      <a
        href="https://hendrix.com.ng/"
        target="_blank"
        rel="noreferrer"
        className="text-secondary hover:text-secondary/80 underline underline-offset-4"
      >
        Hendrix
      </a>
    </footer>
  );
}
