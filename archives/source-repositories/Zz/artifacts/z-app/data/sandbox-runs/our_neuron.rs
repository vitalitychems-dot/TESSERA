fn step(voltage: f64, input: f64) -> (f64, bool) {
    let leaked = voltage * 0.9 + input;
    if leaked >= 1.0 { (0.0, true) } else { (leaked, false) }
}
fn main() {
    let mut voltage = 0.0;
    let mut fires = 0;
    for input in [0.2_f64, 0.2, 0.4, 0.5] {
        let (next, fired) = step(voltage, input);
        voltage = next;
        if fired { fires += 1; }
    }
    println!("fires={fires}");
}
