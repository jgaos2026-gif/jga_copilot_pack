#!/usr/bin/env sh
if [ -z "$husky" ] ; then
  debug () {
    [ "$HUSKY_DEBUG" = "1" ] && echo "husky (debug) - $1"
  }
  readonly husky=1
fi
