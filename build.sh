#!/bin/bash

WATCH_MODE=false

if [ "$1" == "--watch" ]; then
    WATCH_MODE=true
fi

if [ ! -d "dist" ]; then
    mkdir dist
    echo "Pasta 'dist' criada. Instalando dependências..."
    npm install -g esbuild sass
fi

if [ "$WATCH_MODE" = true ]; then
    echo "Modo de observação ativado 🔁"

    # Watch SCSS
    npx sass --watch style.scss:dist/style.css --style=compressed &

    # Watch JS using esbuild's --watch
    npx esbuild script.js --outfile=dist/script.min.js --minify --watch &

    # Wait for background processes
    wait
else
    npx sass style.scss dist/style.css --style=compressed
    npx esbuild script.js --outfile=dist/script.min.js --minify
    echo "Build completo ✅"
fi
