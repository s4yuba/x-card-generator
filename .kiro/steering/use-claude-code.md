# use-claude-code

Use Claude Code when starting/retrying tasks

* Important: Kiro won't implement. Claude Code will do.
* Only proceed when "Start tasks" or "Retry" actions are invoked from `tasks.md`.

When "Start tasks" or "Retry" is detected in a tasks.md file, invoke Claude Code with terminal shell command

```sh
 `claude`
```

If Claude Code is already opened, just use Claude Code.

 Pass the following instruction. The $ARGUMENTS should be the path to the tasks.md file that triggered this hook.

---

## Process Tasks, $ARGUMENTS : path of `tasks.md`

### Procedure (follow strictly)

- step0: check $ARGUMENTS (`tasks.md`)
- step1: create new branch (if you are in main)
- step2: find uncompleted task
- step3: divide tasks into PR size
- step4: process tasks, commit properly
- step5: make uncompleted task checked in `tasks.md`
- step6: continue until the tasks till PR is ready (don't create PR)
