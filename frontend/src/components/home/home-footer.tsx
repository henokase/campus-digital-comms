export function HomeFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="mx-auto">© {new Date().getFullYear()} CDCP Campus Digital Communication Platform.</div>
        <div className="flex items-center gap-4">
          {/* <button className="hover:text-foreground" type="button">
            About
          </button>
          <button className="hover:text-foreground" type="button">
            Privacy
          </button>
          <button className="hover:text-foreground" type="button">
            Support
          </button> */}
        </div>
      </div>
    </footer>
  )
}
