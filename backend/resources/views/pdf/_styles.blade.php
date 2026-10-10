<style>
    @page { margin: 28px 34px; }
    * { font-family: DejaVu Sans, sans-serif; }
    body { font-size: 10.5px; color: #1f2937; }
    .muted { color: #6b7280; }
    .right { text-align: right; }
    .center { text-align: center; }
    table { width: 100%; border-collapse: collapse; }
    .header td { vertical-align: top; }
    .brand { font-size: 17px; font-weight: bold; color: {{ $color }}; }
    .doc-title { font-size: 20px; font-weight: bold; color: {{ $color }}; letter-spacing: 1px; }
    .box { border: 1px solid #d1d5db; border-radius: 6px; padding: 8px 10px; }
    .lines th { background: {{ $color }}; color: #fff; padding: 6px; font-size: 9.5px; text-align: left; }
    .lines td { padding: 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .totals td { padding: 4px 6px; }
    .totals .grand td { font-size: 12.5px; font-weight: bold; border-top: 2px solid {{ $color }}; color: {{ $color }}; }
    .draft { position: fixed; top: 300px; left: 60px; font-size: 80px; color: #f3f4f6; transform: rotate(-30deg); z-index: -1; }
    .footer { position: fixed; bottom: -8px; left: 0; right: 0; font-size: 8.5px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 4px; }
    .stamp { display: inline-block; border: 2px solid #15803d; color: #15803d; padding: 3px 10px; font-weight: bold; border-radius: 4px; }
</style>
