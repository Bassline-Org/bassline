#!/usr/bin/env ruby
# Bassline HTTP Client - Ruby
#
# Zero-dependency client using only standard library.
#
# Usage:
#   ruby client.rb [base_url] [token]
#
# Example:
#   ruby client.rb http://localhost:8080
#   ruby client.rb http://localhost:8080 my-secret-token

require 'net/http'
require 'json'
require 'uri'

class Bassline
  def initialize(base_url = "http://localhost:8080", token = nil)
    @base = base_url.chomp('/')
    @token = token
  end

  def read(ref)
    path = ref.sub(/^bl:\/\/\//, '').sub(/^bl:\/\//, '')
    request(path)
  end

  def write(ref, value)
    path = ref.sub(/^bl:\/\/\//, '').sub(/^bl:\/\//, '')
    request(path, :put, value)
  end

  private

  def request(path, method = :get, data = nil)
    uri = URI("#{@base}/bl/#{path}")
    http = Net::HTTP.new(uri.host, uri.port)

    case method
    when :get
      req = Net::HTTP::Get.new(uri)
    when :put
      req = Net::HTTP::Put.new(uri)
      if data.is_a?(Hash) || data.is_a?(Array)
        req.body = data.to_json
        req['Content-Type'] = 'application/json'
      else
        req.body = data.to_s
      end
    end

    req['Authorization'] = "Bearer #{@token}" if @token

    response = http.request(req)
    parse_response(response.body)
  end

  def parse_response(text)
    JSON.parse(text)
  rescue
    case text
    when 'true' then true
    when 'false' then false
    when 'null' then nil
    when /^-?\d+$/ then text.to_i
    when /^-?\d+\.\d+$/ then text.to_f
    else text
    end
  end
end

if __FILE__ == $0
  base = ARGV[0] || "http://localhost:8080"
  token = ARGV[1]

  bl = Bassline.new(base, token)

  puts "Connected to #{base}"
  puts

  # Demo
  puts "Writing counter = 42"
  bl.write("cell/counter", 42)

  puts "Reading counter: #{bl.read('cell/counter')}"

  puts "Writing user object"
  bl.write("cell/user", { name: "alice", active: true })

  user = bl.read("cell/user")
  puts "Reading user: #{user}"

  # Folds
  bl.write("cell/x", 10)
  bl.write("cell/y", 20)
  sources = "bl:///cell/x,bl:///cell/y"
  puts "Sum(x,y): #{bl.read("fold/sum?sources=#{sources}")}"
end
