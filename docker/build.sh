#!/usr/bin/env sh

version=$(grep "ENV FISH_PEPPER_VERSION" Dockerfile | awk '{ print $3 }')
docker build -t fabric8/fish-pepper:$version .
docker tag --force fabric8/fish-pepper:$version fabric8/fish-pepper:latest