# To generate the index
hugo server &
HUGO_PID=$!
sleep 2
kill $HUGO_PID
#####################
mv './public/index.json' './static/content-data/index.json'
vite build --mode index-bundle --config ./scripts/create-index/vite.config.js
node ./scripts/create-index/download-index.js
echo 'Finished generating vectors'
