set datafile separator ","
set key outside

set terminal svg size 1200,800 enhanced font 'Verdana,10' background rgb 'white'

# set output ARG2

set grid front

set xrange [0:264]
set arrow from 0,0 to 264,0 nohead lw 1 lc rgb "black"
set xtics nomirror 6

set multiplot layout 3,1 title "Shear, Moment, and Deflection Diagrams for " . basename

# Shear diagram
set xlabel "Position (in)"
set ylabel "Shear Force (lb)"
set title "Shear Diagram"
plot inputfile using 1:8 with lines linestyle 1

# Moment diagram
set xlabel "Position (in)"
set ylabel "Moment (lb-in)"
set title "Moment Diagram"
plot inputfile using 1:9 with lines linestyle 2

# Deflection diagram
set xlabel "Position (in)"
set ylabel "Deflection (in)"
set title "Deflection Diagram"
plot inputfile using 1:10 with lines linestyle 3

unset multiplot
