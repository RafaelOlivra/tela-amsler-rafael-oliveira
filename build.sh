#!/bin/bash

WATCH_MODE=false

if [ "$1" == "--watch" ]; then
    WATCH_MODE=true
fi

if [ ! -d "dist" ]; then
    mkdir dist
fi

# Load .env variables
set -a
source .env
set +a

# Function to generate build hash
generate_build_hash() {
    echo $(date +%s%N | sha1sum | head -c 8)
}

# Function to build index.html
build_index() {
    local BUILD_HASH=$(generate_build_hash)

    INDEX_SRC="index-source.html"
    INDEX_OUT="index.html"

    cp "$INDEX_SRC" "$INDEX_OUT"

    # Replace placeholders
    sed -i \
        -e "s|{{TITLE}}|$TITLE|g" \
        -e "s|{{DESCRIPTION}}|$DESCRIPTION|g" \
        -e "s|{{LANGUAGE_CODE}}|$LANGUAGE_CODE|g" \
        -e "s|{{FAVICON_URL}}|$FAVICON_URL|g" \
        -e "s|{{BUILD_HASH}}|$BUILD_HASH|g" \
        "$INDEX_OUT"

    # Replace HEAD_SCRIPTS safely (multiline)
    if [ -n "$HEAD_SCRIPTS" ]; then
        awk -v r="$HEAD_SCRIPTS" '{gsub("{{HEAD_SCRIPTS}}", r)}1' "$INDEX_OUT" > "$INDEX_OUT.tmp" && mv "$INDEX_OUT.tmp" "$INDEX_OUT"
    else
        sed -i "s|{{HEAD_SCRIPTS}}||g" "$INDEX_OUT"
    fi

    # Apply translations
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        ORIG=$(echo "$line" | cut -d"|" -f1)
        TRANS=$(echo "$line" | cut -d"|" -f3-) # handles double pipes
        if [ -n "$TRANS" ]; then
            sed -i "s|__('$ORIG')|$TRANS|g" "$INDEX_OUT"
        else
            # If no translation provided, just remove the __()
            sed -i "s|__('$ORIG')|$ORIG|g" "$INDEX_OUT"
        fi
    done <<< "$(echo "$TRANSLATION_MAP")"

    echo "index.html atualizado ✨"
}

# Compile assets
if [ "$WATCH_MODE" = true ]; then
    echo "Modo de observação ativado 🔁"

    # Build once immediately
    build_index

    # Watch SCSS
    npx sass --watch style.scss:dist/style.css --style=compressed &

    # Watch JS
    npx esbuild script.js --outfile=dist/script.min.js --minify --watch &

    # Watch index-source.html and .env
    while inotifywait -e close_write index-source.html .env; do
        # Reload env vars because .env may have changed
        set -a
        source .env
        set +a
        build_index
    done

else
    npx sass style.scss dist/style.css --style=compressed
    npx esbuild script.js --outfile=dist/script.min.js --minify
    build_index
    echo "Build completo ✅"
fi
