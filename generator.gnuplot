set datafile separator ","
set key outside

set terminal svg size 600,800 enhanced font 'Times New Roman,10' background rgb 'white'

set grid front

set xrange [0:264]
set arrow from 0,0 to 264,0 nohead lw 1 lc rgb "black"
set xtics nomirror 12

set multiplot layout 3,1 title "Configuration " . basename

set label plottext at screen 0.14, screen 0.9665 boxed font ",10"

# Shear diagram
set xlabel "Position (in)"
set ylabel "Shear Force (lb)"
set title "Shear Diagram"
plot inputfile using 1:8 with lines linestyle 1 notitle

# Moment diagram
set xlabel "Position (in)"
set ylabel "Moment (lb-in)"
set title "Moment Diagram"
plot inputfile using 1:9 with lines linestyle 2 notitle

# Deflection diagram
set xlabel "Position (in)"
set ylabel "Deflection (in)"
set title "Deflection Diagram"
plot inputfile using 1:11 with lines linestyle 3 notitle

unset multiplot
