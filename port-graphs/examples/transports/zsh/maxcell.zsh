#!/usr/bin/env zsh

# MaxCell gadget in pure zsh
# Speaks the same protocol as any other gadget

# Gadget state
CURRENT_MAX=0

# Send initial state when connected
echo "{\"changed\":$CURRENT_MAX}"

# Gadget receive function
while IFS= read -r line; do
    [[ -z "$line" ]] && continue

    # Try to parse as JSON with jq if available
    if command -v jq &> /dev/null; then
        # Use jq to extract 'changed' field
        incoming=$(echo "$line" | jq -r '.changed // empty' 2>/dev/null)
    else
        # Fallback: crude regex parsing for {"changed": N}
        if [[ "$line" =~ '"changed"[[:space:]]*:[[:space:]]*([0-9-]+)' ]]; then
            incoming=${match[1]}
        fi
    fi

    if [[ -n "$incoming" ]]; then
        # Consider: is incoming > current?
        if (( incoming > CURRENT_MAX )); then
            # Act: update state
            CURRENT_MAX=$incoming

            # Emit: send changed effect (same format as TypeScript gadget)
            echo "{\"changed\":$CURRENT_MAX}"
            echo "[zsh] Updated max to: $CURRENT_MAX" >&2
        else
            echo "[zsh] Keeping max at: $CURRENT_MAX (incoming was $incoming)" >&2
        fi
    fi
done