export function parseProductInfo(input: string | undefined) {
    if (!input) return "";
    // Tách các phần
    const lines = input.split('\n').map(line => line.trim()).filter(line => line); // Tách và loại bỏ khoảng trắng

    // Tạo cấu trúc dữ liệu để lưu thông tin
    const results = [];

    // Lặp qua các dòng để tách thông tin
    for (let i = 0; i < lines.length; i++) {
        if (i % 2 === 0) { // Dòng chứa số nhóm
            const groupNumber = lines[i];
            const description = lines[i + 1]; // Dòng mô tả
            results.push({ groupNumber, description });
        }
    }

    return results;
}