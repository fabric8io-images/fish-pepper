echo ===================================
echo Deploying fish-pepper documentation
echo ===================================

cd docs && \
npm install -g gitbook-cli && \
git clone -b gh-pages git@github.com:fabric8io/fish-pepper.git && \
mkdir -p _book && \
gitbook install .  && \
gitbook build . && \
cp -rv _book/* gh-pages/ && \
git add * && \
git commit -m "generated documentation" && \
git push origin gh-pages
