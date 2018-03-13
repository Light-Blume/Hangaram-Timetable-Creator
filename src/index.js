'use strict';
import $ from 'jquery';
import { TableExport } from 'tableexport';
import timetableTpl from '../Templates/timetable.handlebars';
import subjectButtonTpl from '../Templates/subject-button.handlebars';
import timetable1JSON from '../Resources/timetable1.json';
import timetable2JSON from '../Resources/timetable2.json';
import timetable3JSON from '../Resources/timetable3.json';
import optionalLessons from '../Resources/optional_lessons.json';
import transpose from './transpose.js';
import Choices from "./Choices";
import TimetableDataManager from "./TimetableDataManager";

let OUTPUT = {};
let cursor, choices;

let grade = -1;

export const BLANK_LESSON = {
    subject: '공강',
    teacher: ''
};

function onSubmitClass() {
    const selectGrade = document.getElementById('select-grade');
    const selectAuditClass = document.getElementById('select-audit-class');

    grade = Number(selectGrade.options[selectGrade.selectedIndex].value);
    const auditClass = Number(selectAuditClass.options[selectAuditClass.selectedIndex].value);

    switch (grade) {
        case 1:
            cursor = new TimetableDataManager(timetable1JSON, auditClass);
            break;
        case 2:
            cursor = new TimetableDataManager(timetable2JSON, auditClass);
            break;
        case 3:
            cursor = new TimetableDataManager(timetable3JSON, auditClass);
            break;
        default:
            return;
    }

    choices = new Choices(cursor);
    this.disabled = true;

    chooseAndAsk()
}
document.getElementById('submit-class').addEventListener('click', onSubmitClass);

function chooseAndAsk() { // 메인 루프. 시간표 데이터를 훑으며 Choices 객체에 추가하다가 정해지지 않은 게 있으면 선택 버튼을 만든다
    loop:do {
        cursor.next();
        const lessons = cursor.lessons;

        switch(lessons.length) {
            case 0:
                choices.choose(BLANK_LESSON);
                break;
            case 1:
                if (!optionalLessons[grade - 1].includes(lessons[0].lesson)) {
                    choices.choose(lessons[0]);
                    break;
                }
            // fall-through if the lesson's optional
            default:
                const includesIndex = lessons.findIndex(lesson => choices.includes(lesson));
                const includesNotIndex = lessons.findIndex(lesson => choices.includesNot(lesson));
                if (includesIndex !== -1) { // 이미 선택한 적이 있으면 그걸 등록
                    choices.choose(lessons[includesIndex]);
                } else { // 새로운 과목들이면 선택 버튼 만들기
                    for (const [index, lesson] of lessons.entries()) {
                        if (!choices.includesNot(lesson)) {
                            $(subjectButtonTpl(lesson))
                                .data( 'lesson', lesson )
                                .click( onClickSubject )
                                .appendTo( '#choose' );
                        }
                    }

                    $(subjectButtonTpl({ subject: '해당 없음', teacher: '' }))  // '해당 없음' 선택지 추가
                        .data( 'lesson', BLANK_LESSON )
                        .click( onClickSubject )
                        .appendTo( '#choose' );

                    break loop;
                }
        }
    } while (!cursor.isLast());

    if (cursor.isLast()) {
        result();
    }
}

function onClickSubject() { // 과목 선택 버튼 이벤트 리스너
    const lesson = $(this).data('lesson');
    choices.choose(lesson);
    const choose = document.getElementById("choose");
    while (choose.firstChild) {
        choose.removeChild(choose.firstChild);
    }

    if (cursor.isLast()) {
        result();
    } else {
        chooseAndAsk();
    }
}


function result() { // 결과를 표시하고 OUTPUT 변수에 저장한다.
    const transposed = transpose(choices.result);
    const arranged = transposed.map((element, i) => {
        return {
            period: i + 1,
            lesson: element
        };
    });

    const data = {
        timetable: arranged
    };

    $('#table').append(timetableTpl(data));
    $('#export-excel').click(exportTable);
    $('#print').click(printTable);

    $('#submit-class')
        .click(refreshPage)
        .html('다시 만들기')
        .prop('disabled', false);

    OUTPUT = arranged
}

function exportTable() {
    const exportManager = new TableExport(document.getElementById("table"), {
        headers: true,                              // (Boolean), display table headers (th or td elements) in the <thead>, (default: true)
        footers: true,                              // (Boolean), display table footers (th or td elements) in the <tfoot>, (default: false)
        formats: ['xlsx'],            // (String[]), filetype(s) for the export, (default: ['xlsx', 'csv', 'txt'])
        filename: 'Timetable',                             // (id, String), filename for the downloaded file, (default: 'id')
        bootstrap: false,                           // (Boolean), style buttons using bootstrap, (default: true)
        exportButtons: false,                        // (Boolean), automatically generate the built-in export buttons for each of the specified formats (default: true)
        ignoreRows: null,                           // (Number, Number[]), row indices to exclude from the exported file(s) (default: null)
        ignoreCols: null,                           // (Number, Number[]), column indices to exclude from the exported file(s) (default: null)
        trimWhitespace: true
    });

    const data = exportManager.getExportData().table.xlsx;
    exportManager.export2file(data.data, data.mimeType, data.filename, data.fileExtension);
}

function printTable() {
    const table = $('#table');
    const printDivSmall = table.clone().appendTo('html').addClass('small');
    const printDivBig = table.clone().appendTo('html').addClass('big');
    document.body.style.display = 'none';
    window.print();
    document.body.style.display = 'block';
    printDivSmall.remove();
    printDivBig.remove();
}

function refreshPage() {
    window.location.reload();
}