# Oldest issue whose author is OWNER/MEMBER/COLLABORATOR or an allowlisted bot login ($allow, comma-separated).
($allow | split(",") | map(gsub("^\\s+|\\s+$"; ""))) as $bots
| map(select((.author_association == "OWNER")
             or (.author_association == "MEMBER")
             or (.author_association == "COLLABORATOR")
             or (.user.login as $u | ($bots | index($u)) != null)))
| .[0] // empty
