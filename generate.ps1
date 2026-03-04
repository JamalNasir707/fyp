$StartDate = Get-Date "2026-03-04"
$EndDate = Get-Date "2026-06-08"
$CurrentDate = $StartDate

$Messages = @(
  "feat: initial update"
  "chore: minor adjustments"
  "fix: bug fixes and improvements"
  "refactor: code cleanup"
  "docs: update logs and notes"
  "feat: incremental progress"
  "fix: resolve issues and stability improvements"
  "chore: general maintenance"
  "refactor: optimize structure"
  "docs: update project notes"
)

$i = 0

while ($CurrentDate -le $EndDate) {
  $Date = Get-Date ($CurrentDate.ToString("yyyy-MM-dd") + " 14:00:00")
  $DateString = $Date.ToString("yyyy-MM-dd HH:mm:ss")
  $Message = "{0}: {1}" -f $Messages[$i % $Messages.Count], $DateString

  Add-Content -Path "log.txt" -Value "Work done on $DateString"
  git add .

  $env:GIT_AUTHOR_DATE = $DateString
  $env:GIT_COMMITTER_DATE = $DateString
  git commit -m $Message

  Remove-Item Env:GIT_AUTHOR_DATE -ErrorAction SilentlyContinue
  Remove-Item Env:GIT_COMMITTER_DATE -ErrorAction SilentlyContinue

  $CurrentDate = $CurrentDate.AddDays(4)
  $i++
}
