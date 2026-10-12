#!/usr/bin/env bash
# goblin-lib.sh — shared helpers for goblin-stack.
#
# Sourced by bin/goblin-install and bin/goblin-verify.
# Dependencies: bash 4+, git, awk, sed, grep, sha256sum (or shasum).
# No npm, no jq, no yq, no network.
#
# The config format is a FLAT, LINE-ORIENTED YAML SUBSET. It is parsed here, never by a
# YAML library, so the same file parses identically on any machine:
#
#   key: value                 top-level scalar
#   key:                       block or list header
#     member: value            two-space-indented block member
#     - item                   two-space-indented list item
#   gates:
#     - name: typecheck        four-space-indented second member of a list entry
#       cmd: npx tsc --noEmit

GOBLIN_LIB_VERSION="0.6.0-beta.1"

# ---------------------------------------------------------------- output -----
# g_trunc <width> <text> — fold a long detail to one line at <width> columns, keeping the
# head. Pure awk substr, no regex: the same shape under every awk (mawk, BWK, gawk).
g_trunc() {
  awk -v w="$1" -v t="$2" 'BEGIN{
    if (length(t) <= w) { print t; exit }
    print substr(t, 1, w - 1) "~"
  }'
}
# g_fold <width> <indent> <text> — word-wrap <text> at <width>, continuing lines at
# <indent> (the cannot-see footer shape). Byte-safe: awk length on bytes approximates
# columns for ASCII prose, which is all this text is.
g_fold() {
  # QA fix (v2-qa issue 9): the rest-assignment used to inline substr() as sub()'s third
  # parameter — not a changeable lvalue, a hard error on gawk 5.2+ (the helper had never
  # been exercised until the remedy fold called it). A temp variable is portable awk.
  awk -v w="$1" -v ind="$2" '
    {
      line = $0
      while (length(line) > w) {
        cut = w
        while (cut > 1 && substr(line, cut, 1) != " ") cut--
        if (cut <= 1) cut = w
        print substr(line, 1, cut)
        rest = substr(line, cut + 1)
        sub(/^[ ]+/, "", rest)
        line = ind rest
      }
      print line
    }'
}
g_pass() {
  if [ "${GOB_VERIFY_VERBOSE:-0}" -eq 1 ]; then
    printf 'PASS  %-6s %s\n' "$1" "$(g_trunc "${GOB_REPORT_COLS:-100}" "$2")"
  elif printf '%s' "$2" | grep -q "$(printf '\n')"; then
    # Multi-line PASS payloads print whole: the payload often IS the pin a test reads
    # (SK-03's advisory-ceiling line), and the collapse must not swallow it.
    printf 'PASS  %-6s %s\n' "$1" "$2"
  else
    printf 'PASS  %-6s (ok)\n' "$1"
  fi
}
# FAIL keeps its row line whole in every mode, and the matrix's remedy column rides under it.
# The remedy is the TSV's own cell (IN-01/IN-02/GT-03/CM-01 carry prose there; the pre-remedy
# rows carry `—`, which prints nothing) — a `remedy:` line, brought to every
# row that names one, so the fix a failure needs is printed where the failure is read. A missing
# column (a manifest written before the column existed) is no remedy, not an error: empty is the
# same as `—`.
g_fail() {
  printf 'FAIL  %-6s %s\n' "$1" "$2"
  local rem
  rem=$(g_remedy "$1")
  case "$rem" in
    —*) return 0 ;;   # an em-dash cell: history and blindness, never a remedy
  esac
  # QA fix (v2-qa issue 9): a remedy is an instruction, not a detail line — truncating it
  # with a ~ cut the command the operator had to type (measured: 'git -c user.ema~').
  # The remedy is now WORD-FOLDED to continuation lines at the report width in every
  # mode (whole text either way); --verbose keeps the single-line form it always had.
  if [ -n "$rem" ]; then
    if [ "${GOB_VERIFY_VERBOSE:-0}" -eq 1 ]; then
      printf 'remedy: %s\n' "$rem"
    else
      printf 'remedy: %s\n' "$rem" | g_fold "${GOB_REPORT_COLS:-100}" "        "
    fi
  fi
}
g_remedy() {
  [ -f "${_GOB_MANIFEST:-}" ] || return 0
  awk -F'\t' -v id="$1" 'NR>1 && $1==id { r = $7; if (r != "") print r; exit }' "${_GOB_MANIFEST:-}"
}
g_adv() {
  # Multi-line ADV payloads print whole: tests pin phrases on the SECOND line of a lane
  # advisory (the W5-6 family statement), and the fold must not eat them. Single-line
  # payloads are the ones the ~100-col truncation is for.
  if printf '%s' "$2" | grep -q "$(printf '\n')"; then
    printf 'ADV   %-6s %s\n' "$1" "$2"
  else
    printf 'ADV   %-6s %s\n' "$1" "$(g_trunc "${GOB_REPORT_COLS:-100}" "$2")"
  fi
}
g_skip() {
  # SKIPs keep their row line in every mode (tests and scripts read them by id). The
  # collapse is the WIDTH, not the disappearance: the reason is truncated to the report
  # width unless --verbose/--only asks for it whole.
  if [ "${GOB_VERIFY_VERBOSE:-0}" -eq 1 ]; then
    printf 'SKIP  %-6s %s\n' "$1" "$2"
  else
    printf 'SKIP  %-6s %s\n' "$1" "$(g_trunc "${GOB_REPORT_COLS:-100}" "$2")"
  fi
}
g_info() { printf '%s\n' "$*"; }
g_err()  { printf 'error: %s\n' "$*" >&2; }

# ------------------------------------------------------------------ hash -----
g_sha256_file() {
  if [ -f "$1" ]; then
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum "$1" | awk '{print $1}'
    else
      shasum -a 256 "$1" | awk '{print $1}'
    fi
  else
    printf 'missing\n'
  fi
}

g_sha256_text() {
  if command -v sha256sum >/dev/null 2>&1; then
    printf '%s' "$1" | sha256sum | awk '{print $1}'
  else
    printf '%s' "$1" | shasum -a 256 | awk '{print $1}'
  fi
}

# ------------------------------------------------------------------ paths ----
# g_abspath <path> — absolute path without requiring the file to exist.
g_abspath() {
  case "$1" in
    /*) printf '%s\n' "$1" ;;
    "~"|"~/"*) printf '%s\n' "$HOME/${1#\~/}" ;;
    *) printf '%s\n' "$PWD/$1" ;;
  esac
}

# g_expand_tilde <path>
g_expand_tilde() {
  case "$1" in
    "~"|"~/"*) printf '%s\n' "$HOME/${1#\~/}" ;;
    *) printf '%s\n' "$1" ;;
  esac
}

# ------------------------------------------------------------------ yaml -----
# g_models_field <mapping-file> <profile> <field> — read one field of one profile out of a
# model mapping file. That file is two-level (a profile header, then its fields), so it is
# read with python3 — the same way the fleet's own tool reads it. Prints nothing if absent.
g_models_field() {
  python3 -c '
import re, sys
path, profile, field = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    lines = open(path, encoding="utf-8", errors="replace").read().split("\n")
except OSError:
    sys.exit(0)
start, base = None, 0
for i, ln in enumerate(lines):
    m = re.match(r"^(\s*)([A-Za-z_][\w.-]*):\s*$", ln)
    if m and m.group(2) == profile:
        start, base = i, len(m.group(1)); break
if start is not None:
    for ln in lines[start + 1:]:
        if not ln.strip() or ln.lstrip().startswith("#"):
            continue
        if len(ln) - len(ln.lstrip()) <= base:
            break
        m = re.match(r"^\s*([A-Za-z_][\w.-]*):\s*(.*)$", ln)
        if m and m.group(1) == field:
            v = m.group(2).strip()
            print(v[1:-1] if len(v) > 1 and v[0] == v[-1] and v[0] in "\"\x27" else v)
            break
' "$1" "$2" "$3"
}

# g_unquote <value> — strip one layer of surrounding double quotes.
g_unquote() {
  local v="$1"
  v=${v%\"}; v=${v#\"}
  printf '%s' "$v"
}

# g_yaml_scalar <file> <key> — value of a top-level scalar key (empty if absent).
g_yaml_scalar() {
  sed -n "s/^$2:[[:space:]]*//p" "$1" | head -n 1
}

# g_yaml_block_scalar <file> <block> <key> — value of a 2-space-indented block member.
g_yaml_block_scalar() {
  awk -v b="$2" -v k="$3" '
    $0 ~ ("^" b ":[[:space:]]*$") { inb = 1; next }
    inb && /^[^ ]/ { inb = 0 }
    inb && $0 ~ ("^  " k ":") {
      v = $0; sub("^  " k ":[[:space:]]*", "", v); print v; exit
    }
  ' "$1"
}

# g_yaml_list <file> <key> — 2-space-indented list items under a top-level list key.
g_yaml_list() {
  awk -v k="$2" '
    $0 ~ ("^" k ":[[:space:]]*$") { inb = 1; next }
    inb && /^[^ ]/ { inb = 0 }
    inb && /^  - / { v = $0; sub(/^  - /, "", v); print v }
  ' "$1"
}

# g_yaml_gates <file> — one "name<TAB>cmd" line per declared gate.
g_yaml_gates() {
  awk '
    /^gates:[[:space:]]*$/ { inb = 1; next }
    inb && /^[^ ]/ { inb = 0 }
    inb && /^  - name:/ { n = $0; sub(/^  - name:[[:space:]]*/, "", n); name = n; next }
    inb && /^    cmd:/ { c = $0; sub(/^    cmd:[[:space:]]*/, "", c);
      if (name != "") { print name "\t" c; name = "" } }
  ' "$1"
}

# g_yaml_gate_names <file> — one declared gate NAME per line, whether or not a `cmd:` follows it.
# g_yaml_gates prints a name only when a `cmd:` LINE follows it, so a gate whose `cmd:` was
# deleted, blanked or re-indented vanishes from it in silence. This reader keeps the name
# visible, which is what lets GT-01 FAIL on the disappearance instead of reporting the
# survivors (G8-3).
g_yaml_gate_names() {
  awk '
    /^gates:[[:space:]]*$/ { inb = 1; next }
    inb && /^[^ ]/ { inb = 0 }
    inb && /^  - name:/ { n = $0; sub(/^  - name:[[:space:]]*/, "", n); print n }
  ' "$1"
}

# g_yaml_gates_all <file> — one "name<TAB>cmd" line per DECLARED gate, including a gate whose
# `cmd:` is missing or blank (the value is printed empty). g_yaml_gates emits only name+cmd
# PAIRS, which is right for running a gate (GT-02) and wrong for counting declarations
# (GT-01): a gate could lose its `cmd:` and the row still printed the survivors (G8-3).
g_yaml_gates_all() {
  awk '
    function flush() { if (name != "") { print name "\t"; name = "" } }
    /^gates:[[:space:]]*$/ { inb = 1; next }
    inb && /^[^ ]/ { flush(); inb = 0 }
    inb && /^  - name:/ { flush(); n = $0; sub(/^  - name:[[:space:]]*/, "", n); name = n; next }
    inb && /^    cmd:/ { c = $0; sub(/^    cmd:[[:space:]]*/, "", c); print name "\t" c; name = "" }
    END { if (inb) flush() }
  ' "$1"
}

# g_yaml_disabled <file> — inline list of disabled parts, one per line.
g_yaml_disabled() {
  local v
  v=$(g_yaml_scalar "$1" disabled)
  case "$v" in
    ""|"[]") return 0 ;;
  esac
  v=${v#[}; v=${v%]}
  printf '%s\n' "$v" | tr ',' '\n' \
    | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | grep -v '^$' || true
}

# g_part_disabled <config> <part>
g_part_disabled() {
  g_yaml_disabled "$1" | grep -qx "$2"
}

# ------------------------------------------------------------- agents.md -----
# v2 config engine: the project config lives in AGENTS.md FRONTMATTER, delimited by
# fixed markers. There is no separate config file. One file is the single source of truth:
#
#   <!-- gob:begin (gobstack config) -->
#   harness_dir: checks
#   source_root: src
#   ratchet.ceiling: 160          # one nested level = a dotted key
#   bans_disabled: [BN-02]        # a list is a one-line JSON-ish array (the ban OFF-switch)
#   gate_commit_cmd: git rev-parse --verify --quiet HEAD
#   <!-- gob:end -->
#
# The parser is the same flat, line-oriented reader the yaml subset used (no YAML
# library, no network, no npm) — it just reads ONLY the lines between the markers, so
# the rest of AGENTS.md (the prose the agent reads) is invisible to it. Rules:
#   * a value is the rest of the line after `key:` — never quoted, never folded
#   * one nested level: `block.key: value` (read with the dotted spelling)
#   * a list: `key: [a, b, c]` on ONE line (g_agents_list splits it)
#   * gates: one key per gate, `gate_<name>_cmd: <cmd>` (g_agents_gates)
#   * comments on their own line, `#` first; blank lines allowed

# The literal markers (grep -F targets; the begin marker carries no closing paren so a
# future annotation after it cannot break the reader).
GOB_AGENTS_BEGIN='<!-- gob:begin'
GOB_AGENTS_END='<!-- gob:end -->'

# g_agents_block <file> — the config lines between the markers (empty if no block).
g_agents_block() {
  sed -n "/^$GOB_AGENTS_BEGIN/,/^$GOB_AGENTS_END/p" "$1" 2>/dev/null | sed '1d;$d'
}

# g_agents_read <file> <key> — value of one key (dotted spelling for the nested level),
# empty if the block or the key is absent.
g_agents_read() {
  g_agents_block "$1" | sed -n "s/^$2:[[:space:]]*//p" | head -n 1
}

# g_agents_keys <file> — every declared key, one per line, in file order.
g_agents_keys() {
  g_agents_block "$1" | sed -n 's/^\([A-Za-z_][A-Za-z0-9_.-]*\):.*/\1/p'
}

# g_agents_gates <file> — one "name<TAB>cmd" line per DECLARED gate. A gate is the key
# `gate_<name>_cmd:`; the declaration and its command are one line, so a gate cannot
# lose its cmd and survive the count (the G8-3 failure mode has no shape here).
g_agents_gates() {
  g_agents_block "$1" | sed -n 's/^gate_\([A-Za-z0-9_-]*\)_cmd:[[:space:]]*/\1\t/p'
}

# g_agents_gate_names <file> — one declared gate NAME per line.
g_agents_gate_names() {
  g_agents_gates "$1" | cut -f1
}

# g_agents_pairs <file> — every block line as `key<TAB>value`, file order. The round-trip
# reader: `g_agents_pairs | g_agents_write` rewrites a block byte-identically, including
# values that contain tabs (a keys+read loop through g_agents_read mangles those — the
# sed in the reader stops at the first colon and the value is rebuilt, so a raw tab inside
# a gate command lost its place and the line drifted on every re-write). Use this for any
# read-modify-write of the block; g_agents_keys is for membership tests only.
# A VALUE-LESS line is stored "key:" (no trailing space — the writer strips it), so the
# ": "-split regex cannot fire: without the key fix below, k kept the trailing colon and
# the pair read back "key:<TAB>key:" - on the next rewrite that rendered "key:: key:"
# and every later read of the key returned its own name (IN-02/PF-01/FM-01 reds on a
# fresh install that declares no practice/feature_map/measured).
g_agents_pairs() {
  # Split at the FIRST ": " (or a trailing bare ":" for a value-less line): index()
  # drives the branch because the ": "-regex cannot fire on the stored "key:" form and
  # a blind sub left k carrying its colon, so pairs read back "key:<TAB>key:".
  g_agents_block "$1" | awk '{
    p = index($0, ": ")
    if (p > 0) { k = substr($0, 1, p - 1); v = substr($0, p + 2) }
    else if ($0 ~ /:$/) { k = substr($0, 1, length($0) - 1); v = "" }
    else { k = $0; v = "" }
    printf "%s\t%s\n", k, v
  }'
}

# g_agents_list <file> <key> — the items of a one-line `[a, b, c]` array, one per line.
# Empty output = the key is absent or the array is empty. An item keeps its inner text
# verbatim (trimmed); a comma inside an item cannot be expressed — split the key.
g_agents_list() {
  local v
  v=$(g_agents_read "$1" "$2")
  case "$v" in
    ""|"[]") return 0 ;;
    \[*\]) ;;
    *) return 0 ;;   # a malformed array reads as absent, never as one garbage item
  esac
  v=${v#\[}; v=${v%\]}
  printf '%s\n' "$v" | tr ',' '\n' \
    | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | grep -v '^$' || true
}

# g_agents_disabled <file> — the disabled: array, one part per line.
g_agents_disabled() { g_agents_list "$1" disabled; }

# g_part_disabled <agents-file> <part>
g_agents_part_disabled() {
  g_agents_disabled "$1" | grep -qx "$2"
}

# g_agents_write <file> — rewrite ONLY the marker block from `key<TAB>value` lines on
# stdin, preserving every line of the body. Idempotent: a second identical write leaves
# the file byte-identical (it prints "unchanged", not "written"). No block + a body:
# the block is inserted before the first line. No file: it is created.
g_agents_write() {
  local f="$1" tmp newbody
  [ -f "$f" ] || : > "$f"
  tmp=$(mktemp "${TMPDIR:-/tmp}/gob-agents.XXXXXX") || return 1
  {
    printf '%s (gobstack config — edit in place; the parser reads only this block) -->\n' "$GOB_AGENTS_BEGIN"
    # A marker line on stdin is a RENDERED TEMPLATE's own first line, not a key: skip
    # it, so a caller may pipe a whole rendered block in. A line is EITHER "key<TAB>
    # value" (the tsv form) OR already-rendered "key: value" (a template form): with a
    # tab, field 1 is the key and the value is rebuilt; without one, the line's own
    # "key: value" shape is kept verbatim (a rendered placeholder keeps its text).
    # A RENDERED line whose VALUE contains a tab would otherwise split at the value's
    # own tab and corrupt it on the next rewrite ("a<TAB>b" became "a: b"), so a line
    # whose pre-tab part already carries ": " is a rendered line: kept verbatim. A tsv
    # key is a bare identifier and never contains ": ".
    awk -F'\t' '
      /^<!-- gob:(begin|end)/ { next }
      NF >= 2 {
        if ($1 ~ /: /) { print; next }
        v = $2; for (i = 3; i <= NF; i++) v = v "\t" $i
        sub(/ -->$/, "", v)   # a template end-marker glued to a value line
        print $1 ": " v
        next
      }
      NF == 1 && $1 != "" { print $1 }' \
      | sed 's/: $/:/'
    printf '%s\n' "$GOB_AGENTS_END"
  } > "$tmp"
  newbody=$(cat "$tmp")
  # Replace the existing block, or insert the block before the first body line.
  # All three values travel via ENVIRON, never -v: gawk (and mawk) process backslash
  # escapes in -v assignment values (\b in a gate command became a backspace on every
  # rewrite - through BOTH this splice and the render above it). ENVIRON passes the
  # bytes raw with no escape processing on any awk.
  if grep -q "^$GOB_AGENTS_BEGIN" "$f"; then
    GOB_BLOCK="$newbody" GOB_BEGIN="$GOB_AGENTS_BEGIN" GOB_END="$GOB_AGENTS_END" \
      awk '
      BEGIN {
        begin = "^" ENVIRON["GOB_BEGIN"]
        end   = "^" ENVIRON["GOB_END"]
        repl  = ENVIRON["GOB_BLOCK"]
      }
      $0 ~ begin { inb = 1; print repl; next }
      $0 ~ end   { inb = 0; next }
      !inb       { print }
    ' "$f" > "$tmp.out" || { rm -f "$tmp" "$tmp.out"; return 1; }
  else
    { printf '%s\n' "$newbody"; cat "$f"; } > "$tmp.out"
  fi
  if cmp -s "$tmp.out" "$f"; then
    rm -f "$tmp" "$tmp.out"; printf 'unchanged\n'; return 0
  fi
  cp "$tmp.out" "$f" && rm -f "$tmp" "$tmp.out" && { printf 'written\n'; return 0; }
  rm -f "$tmp" "$tmp.out"; return 1
}

# ---------------------------------------------------------------- json -------
# installed.json is emitted by goblin-install in a fixed, line-oriented shape so it can
# be read without a JSON library. g_json_object <installed.json> <object-name> -> "key<TAB>value".
g_json_object() {
  awk -v name="$2" '
    index($0, "\"" name "\"") && /:[[:space:]]*\{/ { inf = 1; next }
    inf && /^[[:space:]]*\}/ { inf = 0 }
    inf && /"/ {
      line = $0
      sub(/^[[:space:]]*"/, "", line)
      p = line; sub(/".*/, "", p)
      h = line; sub(/^[^"]*"[[:space:]]*:[[:space:]]*"/, "", h); sub(/".*/, "", h)
      if (p != "") print p "\t" h
    }
  ' "$1"
}

g_installed_files() { g_json_object "$1" files; }

g_installed_scalar() {
  sed -n "s/^[[:space:]]*\"$2\"[[:space:]]*:[[:space:]]*\"\{0,1\}\([^\",]*\)\"\{0,1\},\{0,1\}$/\1/p" "$1" | head -n 1
}

# g_installed_scalar_options <file> <key> — the value of one key inside the "options" object
# of an install record (e.g. skills). The installer writes options on ONE line
# (`"options": {"skills": "yes", ...}`), so the awk reads that line's shape directly; a
# multi-line variant is read the same way the other installed_* readers read their block.
g_installed_scalar_options() {
  awk -v k="$2" '
    /^[[:space:]]*"options"[[:space:]]*:[[:space:]]*\{/ && index($0, "\"" k "\"") {
      # single-line form: pull the value out between the key and the next , or }
      line = $0
      sub(/^[^{]*\{/, "", line)          # everything up to and including the opening brace
      n = split(line, pair, ",")
      for (i = 1; i <= n; i++) {
        p = pair[i]
        sub(/^[[:space:]]*/, "", p); sub(/[[:space:]]*$/, "", p)
        key = p; sub(/[[:space:]]*:.*/, "", key); gsub(/"/, "", key)
        if (key == k) {
          v = p; sub(/^[^:]*:[[:space:]]*/, "", v); gsub(/"/, "", v); sub(/\}[[:space:]]*$/, "", v)
          print v; exit
        }
      }
      exit
    }
    /^[[:space:]]*"options"[[:space:]]*:[[:space:]]*\{/ { inf = 1; next }
    inf && /^[[:space:]]*\}/ { inf = 0 }
    inf && index($0, "\"" k "\"") {
      v = $0; sub(/^[^:]*:[[:space:]]*/, "", v); sub(/,?[[:space:]]*$/, "", v); gsub(/"/, "", v)
      print v; exit
    }
  ' "$1"
}

# g_sed_i <sed-script> <file...> — in-place sed that works on BOTH sed families.
# GNU sed takes -i with an optional suffix attached; BSD sed (macOS) REQUIRES an argument
# after -i (the backup suffix), so a bare `sed -i 's|…|…|' file` makes BSD read the script
# as the suffix and the file as the program — the client's `sed: 1: "...": command a
# expects \ followed by text` (Mac, 2026-10-06). The empty-suffix form `-i ''` is a syntax
# error on GNU, hence the branch. Callers: g_sed_i 's|a|b|' file
g_sed_i() {
  local script="$1"; shift
  if sed --version >/dev/null 2>&1; then
    sed -i "$script" "$@"
  else
    sed -i '' "$script" "$@"
  fi
}

# ------------------------------------------------------------- self-test -----
# Proves the parser actually parses. Every assertion is a real comparison against a
# value written to a temp file in this function — blank the awk in g_yaml_scalar and
# this exits non-zero (that is the RED control for the reader itself).
g_self_test() {
  local tmp rc=0
  tmp=$(mktemp -d 2>/dev/null || mktemp -d -t goblin) || { g_err "mktemp failed"; return 2; }
  cat > "$tmp/g.yaml" <<'YAML'
flavour: B
revision: master
archive: false
disabled: [spec, tokens]
gates:
  - name: typecheck
    cmd: npx tsc --noEmit
ratchet:
  name: hex
  ceiling: 160
runtime_data:
  - .gob/state.json
YAML

  local got
  got=$(g_yaml_scalar "$tmp/g.yaml" flavour)
  [ "$got" = "B" ] || { g_err "scalar: expected B, got '$got'"; rc=1; }
  got=$(g_yaml_scalar "$tmp/g.yaml" revision)
  [ "$got" = "master" ] || { g_err "scalar: expected master, got '$got'"; rc=1; }
  got=$(g_yaml_scalar "$tmp/g.yaml" nosuchkey)
  [ -z "$got" ] || { g_err "scalar: absent key should be empty, got '$got'"; rc=1; }
  got=$(g_yaml_block_scalar "$tmp/g.yaml" ratchet ceiling)
  [ "$got" = "160" ] || { g_err "block scalar: expected 160, got '$got'"; rc=1; }
  got=$(g_yaml_block_scalar "$tmp/g.yaml" ratchet name)
  [ "$got" = "hex" ] || { g_err "block scalar: expected hex, got '$got'"; rc=1; }
  got=$(g_yaml_gates "$tmp/g.yaml" | tr '\t' ':')
  [ "$got" = "typecheck:npx tsc --noEmit" ] || { g_err "gates: got '$got'"; rc=1; }
  # The gates-all readers exist for the one case the pair reader hides: a gate whose `cmd:` LINE
  # is missing (deleted or re-indented). g_yaml_gates drops it; g_yaml_gates_all keeps it with an
  # empty cmd and g_yaml_gate_names still names it. Blank either awk and this exits non-zero -
  # that is this self-test's own RED control for the G8-3 fix (the disappearance GT-01 must FAIL).
  printf 'gates:\n  - name: typecheck\n    cmd: npx tsc --noEmit\n  - name: reindented\n  cmd: false\n' > "$tmp/g2.yaml"
  got=$(g_yaml_gates "$tmp/g2.yaml" | wc -l | tr -d '[:space:]')
  [ "$got" = "1" ] || { g_err "gates: a cmd-less gate should vanish from the pair reader, got $got line(s)"; rc=1; }
  got=$(g_yaml_gates_all "$tmp/g2.yaml" | wc -l | tr -d '[:space:]')
  [ "$got" = "2" ] || { g_err "gates-all: expected 2 declared gates, got $got"; rc=1; }
  got=$(g_yaml_gates_all "$tmp/g2.yaml" | awk -F'\t' '$1 == "reindented" && $2 == ""' | wc -l | tr -d '[:space:]')
  [ "$got" = "1" ] || { g_err "gates-all: the cmd-less gate was not reported with an empty cmd"; rc=1; }
  got=$(g_yaml_gate_names "$tmp/g2.yaml" | tr '\n' ',')
  [ "$got" = "typecheck,reindented," ] || { g_err "gate-names: got '$got'"; rc=1; }
  got=$(g_yaml_list "$tmp/g.yaml" runtime_data | tr '\n' ',')
  [ "$got" = ".gob/state.json," ] || { g_err "list: got '$got'"; rc=1; }
  got=$(g_yaml_disabled "$tmp/g.yaml" | tr '\n' ',')
  [ "$got" = "spec,tokens," ] || { g_err "disabled: got '$got'"; rc=1; }

  # ---- the v2 AGENTS.md frontmatter engine (the same RED control, new file) ----
  cat > "$tmp/AGENTS.md" <<'EOF'
# AGENTS.md

House rules the agent reads. The block below is machine-read.

<!-- gob:begin (gobstack config — edit in place; the parser reads only this block) -->
flavour: software
revision: main
archive: false
disabled: [spec, tokens]
ratchet.name: hex
ratchet.ceiling: 160
gate_typecheck_cmd: npx tsc --noEmit
gate_commit_cmd: git rev-parse --verify --quiet HEAD
<!-- gob:end -->

Body prose continues here. A line like `flavour: decoy` outside the block must stay
invisible to the parser.
EOF
  printf 'flavour: decoy\n' >> "$tmp/AGENTS.md"
  got=$(g_agents_read "$tmp/AGENTS.md" flavour)
  [ "$got" = "software" ] || { g_err "agents scalar: expected software, got '$got'"; rc=1; }
  got=$(g_agents_read "$tmp/AGENTS.md" nosuchkey)
  [ -z "$got" ] || { g_err "agents scalar: absent key should be empty, got '$got'"; rc=1; }
  got=$(g_agents_read "$tmp/AGENTS.md" ratchet.ceiling)
  [ "$got" = "160" ] || { g_err "agents dotted key: expected 160, got '$got'"; rc=1; }
  got=$(g_agents_read "$tmp/AGENTS.md" ratchet.name)
  [ "$got" = "hex" ] || { g_err "agents dotted key: expected hex, got '$got'"; rc=1; }
  got=$(g_agents_gates "$tmp/AGENTS.md" | tr '\t' ':')
  [ "$got" = "typecheck:npx tsc --noEmit
commit:git rev-parse --verify --quiet HEAD" ] \
    || { g_err "agents gates: got '$got'"; rc=1; }
  got=$(g_agents_gate_names "$tmp/AGENTS.md" | tr '\n' ',')
  [ "$got" = "typecheck,commit," ] || { g_err "agents gate-names: got '$got'"; rc=1; }
  got=$(g_agents_list "$tmp/AGENTS.md" disabled | tr '\n' ',')
  [ "$got" = "spec,tokens," ] || { g_err "agents list: got '$got'"; rc=1; }
  got=$(g_agents_keys "$tmp/AGENTS.md" | head -n 1)
  [ "$got" = "flavour" ] || { g_err "agents keys: got '$got'"; rc=1; }
  # g_agents_write: stdin IS the whole new block (key<TAB>value lines); it rewrites
  # ONLY the block and preserves the body. Idempotent on a second identical write.
  {
    printf '%s\tsoftware\n' flavour
    printf '%s\tmain\n' revision
    printf '%s\t42\n' max_dirty
  } | g_agents_write "$tmp/AGENTS.md" >/dev/null
  grep -q '^max_dirty: 42$' "$tmp/AGENTS.md" || { g_err "agents write: the new key is absent"; rc=1; }
  grep -qF 'Body prose continues here' "$tmp/AGENTS.md" \
    || { g_err "agents write: the body was not preserved"; rc=1; }
  grep -qF 'flavour: decoy' "$tmp/AGENTS.md" \
    || { g_err "agents write: the body below the block was not preserved"; rc=1; }
  W1=$(g_agents_read "$tmp/AGENTS.md" flavour)
  [ "$W1" = "software" ] || { g_err "agents write: the block was destroyed ($W1)"; rc=1; }
  {
    printf '%s\tsoftware\n' flavour
    printf '%s\tmain\n' revision
    printf '%s\t42\n' max_dirty
  } | g_agents_write "$tmp/AGENTS.md" > "$tmp/w2"
  grep -q unchanged "$tmp/w2" || { g_err "agents write: the second identical write is not a no-op"; rc=1; }
  # A fresh file: the block is created, and a body-less write stays parseable.
  printf '%s\ttrue\n' "toggle" | g_agents_write "$tmp/fresh.md" >/dev/null
  [ "$(g_agents_read "$tmp/fresh.md" toggle)" = "true" ] \
    || { g_err "agents write: a fresh file was not created parseable"; rc=1; }
  # A body-only file: the block is inserted before the first line.
  printf 'the body\n' > "$tmp/bodyonly.md"
  printf '%s\tmain\n' "revision" | g_agents_write "$tmp/bodyonly.md" >/dev/null
  [ "$(g_agents_read "$tmp/bodyonly.md" revision)" = "main" ] \
    && grep -qx 'the body' "$tmp/bodyonly.md" \
    || { g_err "agents write: insertion into a body-only file failed"; rc=1; }

  rm -rf "$tmp"
  if [ "$rc" -eq 0 ]; then
    printf 'OK\n'
  else
    printf 'SELF-TEST FAILED\n' >&2
  fi
  return "$rc"
}

# g_next_block <target> <skills yes|no> [<declared-gate label>]
# THE one ordered next-steps list a completed install prints. `gob init --write` runs the engine
# (goblin-install), which calls this; init then calls it again for its own tail — so a user sees
# ONE list, never the two the front-door engine and the installer each used to print. Every line
# is true of the artefact the user now has:
#   * the install is uncommitted (the record is written last and git is the user's to run);
#   * verify re-runs the gate the config declares (GT-02);
#   * when a gate LABEL is given the gate is the one the user declared and `gob init --write`
#     MEASURED before writing it, so no edit is owed — the advice is only "edit the default gate"
#     on a bare `goblin-install`, whose shipped gate is a generic default;
#   * the seven-skill CORE tier ships under .gob/skills/ on EVERY install, so the agent-skill
#     switch is about the .hermes/ project tier, not about whether any skill is present.
g_next_block() {
  local target="$1" skills="$2" gate="${3:-}" gline
  if [ -n "$gate" ]; then
    gline="the gate is the one you declared and gob init measured ($gate); edit AGENTS.md's gate_ keys when it changes"
  else
    gline="edit AGENTS.md: replace the default gate with your real commands"
  fi
  printf 'next:\n'
  printf '  1. cd %s && git add -A && git commit   # the install is uncommitted by design\n' "$target"
  printf '  2. .gob/bin/goblin-verify   # re-runs the gate the config declares; green on a fresh repo\n'
  printf '  3. %s\n' "$gline"
  if [ "$skills" = "yes" ]; then
    printf '  4. hermes skills trust %s   # one-time, so the .hermes/ project tier loads\n' "$target"
  elif [ "$skills" = "no" ]; then
    printf '  4. the core goblin tier ships under .gob/skills/ by default; the .hermes/ project tier is opt-in: re-run with --skills yes\n'
  elif [ "$skills" = "all" ]; then
    printf '  4. all skills vendored under .gob/skills/; the .hermes/ project tier is opt-in: re-run with --skills yes\n'
  else
    printf '  4. vendored under .gob/skills/: %s; the .hermes/ project tier is opt-in: re-run with --skills yes\n' "$skills"
  fi
}

# Allow `bash bin/goblin-lib.sh --self-test` and `source bin/goblin-lib.sh`.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  case "${1:-}" in
    --self-test) g_self_test ;;
    --version)   printf '%s\n' "$GOBLIN_LIB_VERSION" ;;
    *)           printf 'usage: goblin-lib.sh --self-test\n' >&2; exit 2 ;;
  esac
  exit $?
fi
