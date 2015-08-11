FROM alpine:3.2

ENV FISH_PEPPER_VERSION 0.0.13

RUN apk add --update nodejs \
 && npm -g install fish-pepper@${FISH_PEPPER_VERSION} \
 && mkdir /fp

ENTRYPOINT [ "fish-pepper" ]
CMD [ "-h" ]
