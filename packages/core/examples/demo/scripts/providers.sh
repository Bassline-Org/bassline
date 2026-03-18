# provider in main lobby
node demo/provider.js /tmp/bl-demo.sock /tmp/bl-other.sock foo,bar,baz &

# provider in secondary lobby
node demo/provider.js /tmp/bl-other.sock /tmp/bl-demo.sock something,another