#!/bin/env ruby

require 'fileutils'
require 'open3'

input_dir = 'csvs'
output_dir = 'plots'
gnuplot_script = 'generator.gnuplot'

FileUtils.mkdir_p(output_dir) unless Dir.exist?(output_dir)

Dir.glob("#{input_dir}/*.csv").each do |csv_file|
  base_name = File.basename(csv_file, '.csv')
  output_file = "#{output_dir}/#{base_name}.svg"

  desc = File.read("#{input_dir}/#{base_name}.txt")

  cmd = "gnuplot -e \"plottext='#{desc}';basename='#{base_name}'; inputfile='#{csv_file}'\" #{gnuplot_script}"

  puts cmd

  stdout, stderr, status = Open3.capture3(cmd)

  if status.success?
    File.write(output_file, stdout)
  else
    puts "Error processing #{csv_file}: #{stderr}"
  end
end
