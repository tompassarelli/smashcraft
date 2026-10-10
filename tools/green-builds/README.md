# Green playtest builds

`smashcraft-green-builds.timer` runs `smashcraft-green-builds.service` every ten
minutes on Tom's machine; the service runs `bun wisp play --install-green` from
its own detached worktree, `worktrees/green-builds-runner`, moved to
`origin/main` before each run (docs/commands/play.md). These files are not installed by the
repository.

To install them:

    mkdir -p ~/.config/systemd/user
    cp tools/green-builds/smashcraft-green-builds.{service,timer} ~/.config/systemd/user/
    systemctl --user daemon-reload
    systemctl --user enable --now smashcraft-green-builds.timer

`gh` must be signed in for the user the timer runs as. To stop it:
`systemctl --user disable --now smashcraft-green-builds.timer`.
