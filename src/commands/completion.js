'use strict';

const { die } = require('../output');

const BASH = `# ntn bash completion. Source this file or add to ~/.bashrc:
#   eval "$(ntn completion bash)"
_ntn() {
  local cur prev words cword
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  local top="login logout reset update doctor experiments completion api search pages datasources files workers tools"
  if [ "$COMP_CWORD" -eq 1 ]; then
    COMPREPLY=( $(compgen -W "$top" -- "$cur") )
    return 0
  fi
  case "\${COMP_WORDS[1]}" in
    pages) COMPREPLY=( $(compgen -W "get create update trash" -- "$cur") );;
    datasources) COMPREPLY=( $(compgen -W "query resolve get" -- "$cur") );;
    files) COMPREPLY=( $(compgen -W "create get list complete" -- "$cur") );;
    workers) COMPREPLY=( $(compgen -W "list get new deploy delete runs env capabilities webhooks sync oauth usage exec tui" -- "$cur") );;
    login) COMPREPLY=( $(compgen -W "poll" -- "$cur") );;
    completion) COMPREPLY=( $(compgen -W "bash zsh fish powershell elvish" -- "$cur") );;
  esac
}
complete -F _ntn ntn
`;

const ZSH = `#compdef ntn
# ntn zsh completion. Source this file or add to ~/.zshrc:
#   eval "$(ntn completion zsh)"
_ntn() {
  local -a commands
  commands=(
    'login:Authenticate with Notion'
    'logout:Log out'
    'reset:Remove all CLI data'
    'update:Update ntn'
    'doctor:Check CLI health'
    'completion:Generate shell completions'
    'api:Make API requests'
    'search:Search Notion'
    'pages:Manage pages'
    'datasources:Manage data sources'
    'files:Upload and manage files'
    'workers:Manage Notion Workers'
    'tools:Call Agent 2.0 tools'
  )
  _describe 'command' commands
}
compdef _ntn ntn
`;

const FISH = `# ntn fish completion. Save as ~/.config/fish/completions/ntn.fish or:
#   ntn completion fish | source
complete -c ntn -f
complete -c ntn -n '__fish_use_subcommand' -a 'login logout reset update doctor completion api search pages datasources files workers tools'
complete -c ntn -n '__fish_seen_subcommand_from pages' -a 'get create update trash'
complete -c ntn -n '__fish_seen_subcommand_from datasources' -a 'query resolve get'
complete -c ntn -n '__fish_seen_subcommand_from files' -a 'create get list complete'
complete -c ntn -n '__fish_seen_subcommand_from workers' -a 'list get new deploy delete runs env capabilities webhooks sync oauth usage exec'
complete -c ntn -n '__fish_seen_subcommand_from login' -a 'poll'
complete -c ntn -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish powershell elvish'
`;

const POWERSHELL = `# ntn PowerShell completion. Add to your $PROFILE:
#   ntn completion powershell | Out-String | Invoke-Expression
Register-ArgumentCompleter -Native -CommandName ntn -ScriptBlock {
  param($wordToComplete, $commandAst, $cursorPosition)
  $top = @('login','logout','reset','update','doctor','completion','api','search','pages','datasources','files','workers','tools')
  $tokens = $commandAst.CommandElements | ForEach-Object { $_.ToString() }
  if ($tokens.Count -le 2) {
    $top | Where-Object { $_ -like "$wordToComplete*" } |
      ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
    return
  }
  $sub = $tokens[1]
  $subs = @{
    'pages'       = @('get','create','update','trash')
    'datasources' = @('query','resolve','get')
    'files'       = @('create','get','list','complete')
    'workers'     = @('list','get','new','deploy','delete','runs','env','capabilities','webhooks','sync','oauth','usage','exec')
    'login'       = @('poll')
    'completion'  = @('bash','zsh','fish','powershell','elvish')
  }
  if ($subs.ContainsKey($sub)) {
    $subs[$sub] | Where-Object { $_ -like "$wordToComplete*" } |
      ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }
  }
}
`;

const ELVISH = `# ntn elvish completion. Add to ~/.elvish/rc.elv:
#   eval (ntn completion elvish | slurp)
set edit:completion:arg-completer[ntn] = { |@words|
  if (== (count $words) 2) {
    put login logout reset update doctor completion api search pages datasources files workers tools
  } else {
    var sub = $words[1]
    if (eq $sub pages) { put get create update trash }
    if (eq $sub datasources) { put query resolve get }
    if (eq $sub files) { put create get list complete }
    if (eq $sub workers) { put list get new deploy delete runs env capabilities webhooks sync oauth usage exec }
    if (eq $sub login) { put poll }
    if (eq $sub completion) { put bash zsh fish powershell elvish }
  }
}
`;

function runCompletion(shell) {
  const m = { bash: BASH, zsh: ZSH, fish: FISH, powershell: POWERSHELL, pwsh: POWERSHELL, elvish: ELVISH };
  const s = m[String(shell || '').toLowerCase()];
  if (!s) die(`Unknown shell '${shell}'. Use bash, zsh, fish, powershell, or elvish.`);
  process.stdout.write(s);
}

module.exports = { runCompletion };
