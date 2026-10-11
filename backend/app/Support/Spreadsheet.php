<?php

namespace App\Support;

use DateTimeInterface;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Writer;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Classeur Excel (.xlsx) écrit avec OpenSpout : une feuille par tableau, ligne d'en-tête en gras,
 * dates au format jj/mm/aaaa, montants en nombres (sommables dans Excel).
 */
final class Spreadsheet
{
    /**
     * @param  list<array{name: string, columns: list<string>, rows: iterable<list<mixed>>, widths?: list<float>}>  $sheets
     */
    public static function download(string $filename, array $sheets): BinaryFileResponse
    {
        $path = tempnam(sys_get_temp_dir(), 'borom-xlsx-');
        $writer = new Writer;
        $writer->openToFile($path);
        $header = (new Style)->setFontBold()->setBackgroundColor('E8ECF2');
        $date = (new Style)->setFormat('dd/mm/yyyy');
        $money = (new Style)->setFormat('#,##0');

        foreach ($sheets as $i => $sheet) {
            $current = $i === 0 ? $writer->getCurrentSheet() : $writer->addNewSheetAndMakeItCurrent();
            $current->setName(mb_substr(str_replace(['/', '\\', '?', '*', '[', ']', ':'], '-', $sheet['name']), 0, 31));
            foreach ($sheet['widths'] ?? [] as $column => $width) {
                $current->setColumnWidth($width, $column + 1);
            }
            $writer->addRow(Row::fromValues($sheet['columns'], $header));
            foreach ($sheet['rows'] as $values) {
                $styles = [];
                foreach ($values as $k => $value) {
                    if ($value instanceof DateTimeInterface) {
                        $styles[$k] = $date;
                    } elseif (is_int($value)) {
                        $styles[$k] = $money;
                    }
                }
                $writer->addRow(Row::fromValuesWithStyles($values, null, $styles));
            }
        }
        $writer->close();

        return response()->download($path, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ])->deleteFileAfterSend();
    }
}
