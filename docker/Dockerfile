FROM alpine:3.2

ENV FISH_PEPPER_VERSION 0.0.14

RUN apk add --update nodejs \
 && npm -g install fish-pepper@${FISH_PEPPER_VERSION} \
 && mkdir /fp

VOLUME /fp
WORKDIR /fp

ENTRYPOINT [ "fish-pepper" ]
