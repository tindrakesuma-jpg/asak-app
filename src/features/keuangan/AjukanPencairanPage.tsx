import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Package = {
  id: string;
  anak_id: string;
  component_type: string;
  nominal: number;
   anak_asak: {
    name: string;
    education_level: string | null;
    school_name: string;
    school_account_bank: string | null;
    school_account_number: string | null;
    school_account_name: string | null;
    parent_account_bank: string | null;
    parent_account_number: string | null;
    parent_account_name: string | null;
  } | null;
};

export default function AjukanPencairanPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<Record<string, 'sekolah' | 'orang_tua'>>({});

  async function loadData() {
    setLoading(true);
    const { data } = await supabase
      .from('bantuan_packages')
      .select(`
        id, anak_id, component_type, nominal,
        anak_asak (name, education_level, school_name, school_account_bank, school_account_number, school_account_name, parent_account_bank, parent_account_number, parent_account_name)
      `);
    setPackages(((data ?? []) as any));
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAjukan(pkg: Package) {
    if (!pkg.anak_asak) return;
    setSubmitting(pkg.id);
    const { data: userData } = await supabase.auth.getUser();

    const type = targetType[pkg.id] ?? 'sekolah';
    const feeTypeMap: Record<string, string> = {
      uang_pangkal: 'uang_pangkal',
      spp_bulanan: 'sks_spp',
      tunjangan_semester: 'tunjangan',
    };

    const bank = type === 'sekolah' ? pkg.anak_asak.school_account_bank : pkg.anak_asak.parent_account_bank;
    const number = type === 'sekolah' ? pkg.anak_asak.school_account_number : pkg.anak_asak.parent_account_number;
    const accName = type === 'sekolah' ? pkg.anak_asak.school_account_name : pkg.anak_asak.parent_account_name;

    const { error } = await supabase.from('disbursement_requests').insert({
      anak_id: pkg.anak_id,
      package_id: pkg.id,
      fee_type: feeTypeMap[pkg.component_type] ?? 'sks_spp',
      amount: pkg.nominal,
      target_account_type: type,
      target_account_bank: bank ?? '-',
      target_account_number: number ?? '-',
      target_account_name: accName ?? '-',
      school_year: '2026/2027',
      item_status: 'menunggu_dipilih',
      created_by: userData.user?.id,
    });

    setSubmitting(null);
    if (error) {
      alert('Gagal: ' + error.message);
      return;
    }
    alert('Berhasil diajukan ke antrian pencairan.');
  }

  if (loading) return <p className="text-center mt-16">Memuat...</p>;

  return (
    <div className="max-w-2xl mx-auto mt-8 p-4">
      <h2 className="text-xl font-bold mb-4">Ajukan Pencairan dari Paket Bantuan</h2>

      <div className="space-y-3">
        {packages.map((pkg) => (
          <div key={pkg.id} className="border rounded-lg p-4">
            <p className="font-semibold">{pkg.anak_asak?.name}</p>
            <p className="text-sm text-gray-600">
              {pkg.component_type} — Rp{pkg.nominal.toLocaleString('id-ID')}
            </p>
            <div className="flex gap-2 mt-2">
              <select
                value={targetType[pkg.id] ?? 'sekolah'}
                onChange={(e) => setTargetType({ ...targetType, [pkg.id]: e.target.value as any })}
                className="border rounded-lg px-2 py-1.5 text-sm"
              >
                <option value="sekolah">
                    {pkg.anak_asak?.education_level === 'PT' ? 'Rekening Universitas' : 'Rekening Sekolah'}
                </option>
                <option value="orang_tua">Rekening Orang Tua</option>
                </select>
              <button
                onClick={() => handleAjukan(pkg)}
                disabled={submitting !== null}
                className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm"
              >
                {submitting === pkg.id ? 'Mengajukan...' : 'Ajukan ke Antrian'}
              </button>
            </div>
          </div>
        ))}
        {packages.length === 0 && <p className="text-gray-500">Belum ada paket bantuan.</p>}
      </div>
    </div>
  );
}