import React, { useState } from 'react';
import { 
  BookOpen, CheckCircle2, XCircle, AlertCircle, FileText, 
  Truck, Wrench, ArrowRight, GitBranch, Info, Clock, 
  MapPin, ShieldAlert, FileCheck, Search, Send, Ship, Calendar, HelpCircle
} from 'lucide-react';

const Step = ({ number, title, subtitle, children }: any) => (
  <div className="relative flex gap-6 md:gap-8 pb-12 last:pb-0">
    {/* Timeline Line */}
    <div className="absolute left-[23px] md:left-[27px] top-14 bottom-0 w-1 bg-brand-dark/10 rounded-full" />
    
    {/* Step Number */}
    <div className="relative z-10 flex flex-col items-center">
      <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-brand-dark text-brand-light flex items-center justify-center font-bold text-xl md:text-2xl shadow-md shrink-0 border-4 border-white">
        {number}
      </div>
    </div>
    
    {/* Content Card */}
    <div className="flex-1 pt-1">
      <div className="bg-white rounded-2xl border border-brand-secondary/30 shadow-sm overflow-hidden">
        <div className="bg-brand-muted/15 px-6 py-5 border-b border-brand-secondary/30">
          <h3 className="text-xl md:text-2xl font-bold text-brand-dark">{title}</h3>
          {subtitle && <p className="text-brand-dark/80 text-base mt-1.5 font-medium">{subtitle}</p>}
        </div>
        <div className="p-6 md:p-8 space-y-6">
          {children}
        </div>
      </div>
    </div>
  </div>
);

const Task = ({ icon: Icon, title, description, children, variant = 'default' }: any) => {
  const isAlert = variant === 'alert';
  return (
    <div className="flex gap-4 items-start">
      <div className={`mt-1 p-2.5 rounded-xl shrink-0 ${isAlert ? 'bg-rose-100 text-rose-600' : 'bg-brand-muted/15 text-brand-dark/80'}`}>
        {Icon ? <Icon size={24} /> : <CheckCircle2 size={24} />}
      </div>
      <div className="flex-1">
        <h4 className={`font-bold text-lg ${isAlert ? 'text-rose-900' : 'text-brand-dark'}`}>{title}</h4>
        {description && <div className={`mt-2 text-base whitespace-pre-line leading-relaxed ${isAlert ? 'text-rose-700' : 'text-brand-dark/80'}`}>{description}</div>}
        {children && <div className="mt-4">{children}</div>}
      </div>
    </div>
  );
};

const Decision = ({ condition, children }: any) => (
  <div className="mt-6 bg-brand-dark/[0.02] border border-brand-secondary/30 rounded-xl overflow-hidden">
    <div className="bg-brand-muted/15 px-5 py-3 border-b border-brand-secondary/30 flex items-center gap-3 font-bold text-brand-dark/80 text-base">
      <GitBranch size={18} className="text-brand-secondary" />
      Decision: {condition}
    </div>
    <div className="p-4 flex flex-col gap-4">
      {React.Children.map(children, child => (
        <div className="flex-1">{child}</div>
      ))}
    </div>
  </div>
);

const Path = ({ type, title, children }: any) => {
  const isYes = type === 'yes';
  const isNo = type === 'no';
  const isInfo = type === 'info';
  
  let bg = 'bg-white';
  let border = 'border-brand-secondary/30';
  let text = 'text-brand-dark';
  let Icon = ArrowRight;
  let iconColor = 'text-brand-secondary';

  if (isYes) { border = 'border-emerald-200'; iconColor = 'text-emerald-500'; Icon = CheckCircle2; }
  if (isNo) { border = 'border-rose-200'; iconColor = 'text-rose-500'; Icon = XCircle; }
  if (isInfo) { border = 'border-brand-secondary/30'; iconColor = 'text-brand-secondary'; Icon = Info; }

  return (
    <div className={`border rounded-xl p-5 h-full ${bg} ${border} shadow-sm transition-all hover:shadow-md`}>
      <div className={`flex items-center gap-2.5 font-bold mb-3 text-lg ${text}`}>
        <Icon size={20} className={iconColor} />
        {title}
      </div>
      <div className="text-brand-dark/80 text-base space-y-3 leading-relaxed pl-7">
        {children}
      </div>
    </div>
  );
};

const SectionHeader = ({ title }: { title: string }) => (
  <div className="flex items-center gap-4 mb-10 mt-16 first:mt-4">
    <div className="h-px bg-brand-dark/20 flex-1" />
    <h2 className="text-2xl font-bold text-brand-dark bg-brand-muted/15 px-6 py-2 rounded-full border border-brand-secondary/30">
      {title}
    </h2>
    <div className="h-px bg-brand-dark/20 flex-1" />
  </div>
);

export function SOPView() {
  const [activeSopTab, setActiveSopTab] = useState<'transport-hde' | 'transport-hpt' | 'installation'>('transport-hde');

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 pb-16 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-brand-secondary/30">
        <h2 className="text-3xl font-bold text-brand-dark flex items-center gap-4 mb-8">
          <BookOpen size={36} className="text-brand-dark/80" />
          Standard Operating Procedures
        </h2>
        
        <div className="flex flex-wrap gap-4 border-b border-brand-secondary/30">
          <button 
            onClick={() => setActiveSopTab('transport-hde')}
            className={`pb-4 px-6 text-lg font-bold transition-colors border-b-4 ${activeSopTab === 'transport-hde' ? 'border-brand-dark text-brand-dark' : 'border-transparent text-brand-secondary hover:text-brand-dark'}`}
          >
            Transportation (HDE)
          </button>
          <button 
            onClick={() => setActiveSopTab('transport-hpt')}
            className={`pb-4 px-6 text-lg font-bold transition-colors border-b-4 ${activeSopTab === 'transport-hpt' ? 'border-brand-dark text-brand-dark' : 'border-transparent text-brand-secondary hover:text-brand-dark'}`}
          >
            Transportation (HPT)
          </button>
          <button 
            onClick={() => setActiveSopTab('installation')}
            className={`pb-4 px-6 text-lg font-bold transition-colors border-b-4 ${activeSopTab === 'installation' ? 'border-brand-dark text-brand-dark' : 'border-transparent text-brand-secondary hover:text-brand-dark'}`}
          >
            Installation
          </button>
        </div>
      </div>

      <div className="py-4">
        {activeSopTab === 'transport-hde' && (
          <div className="space-y-2">
            <Step number="1" title="ISF filing">
              <Task 
                icon={FileText}
                title="Request for ISF filing to customer broker" 
                description={"(24~48 Hrs before actual shipment)\n\n• Frontier : over 60 MVA (handle by HDE)\n• World Asia : below 60 MVA (Handle by HEA)"} 
              />
            </Step>

            <Step number="2" title="Vendor Assigned" subtitle="(Contract Management Team will assign the Vendor and issue PO)">
              <Task 
                icon={Truck}
                title="Files to be shared with Vendor" 
                description={"1. Cargo value for the transportation insurance\n2. Site Contact Information (for site visit)\n3. Estimated port arrival date to assigned port"} 
              />
            </Step>

            <Step number="3" title="Requests to vendor">
              <Task 
                icon={Search}
                title="Required Vendor Actions" 
                description={"1. Site visit\n2. Route survey\n3. Rail car / Truck order\n4. Rail Clearance\n5. Road permit\n6. Preliminary transportation plan"} 
              />
            </Step>

            <Step number="4" title="Transformer Depart from Port (Korea)">
              <Task 
                icon={Ship}
                title="Process Inventory based on Bill of Lading" 
              />
            </Step>

            <Step number="5" title="Receive Preliminary transportation plan after site visit" subtitle="(review and share with customer)">
              <Decision condition="Customer Confirmation">
                <Path type="yes" title="If Confirmed">
                  Submit the final transportation plan when the transformer is ready to ship out.
                </Path>
                <Path type="no" title="If Rejected / Needs Revision">
                  <div className="space-y-2">
                    <p>1. Request revision based on the comments from customer.</p>
                    <p>2. Submit the revision for customer's approval.</p>
                  </div>
                </Path>
              </Decision>
              <div className="mt-6">
                <Task 
                  icon={FileCheck}
                  title="Request Shipping Documents" 
                  description="COO, Invoice & packing list, marine survey report" 
                />
              </div>
            </Step>

            <Step number="6" title="Provide Arrival Notice to Vendor and customs broker for customs clearance">
              <Task 
                icon={FileText}
                title="Customs clearance → Request AP process for invoices from the brokers" 
                description={"• Frontier : over 60 MVA\n• World Asia : below 60 MVA\n\n* If census warning is received from customer broker, review & sign documents by team leader or head and send it back to the customer broker."} 
              />
              <div className="mt-6">
                <Task 
                  icon={Send}
                  title="Communication with overseas agent" 
                  description="(ex. GL Network) for pick up schedule at the port" 
                />
              </div>
            </Step>

            <Step number="7" title="Check Rail clearance & road permit status">
              <Decision condition="Approval Status">
                <Path type="yes" title="If All Approved">
                  Be ready for the transportation.
                </Path>
                <Path type="no" title="If Pending">
                  <div className="space-y-2">
                    <p>1. Check the status with vendor until the final approval.</p>
                    <p>2. If all approved, be ready to ship the unit.</p>
                  </div>
                </Path>
              </Decision>
            </Step>

            <Step number="8" title="Transportation to Job Site">
              <Task 
                icon={MapPin}
                title="Provide GPS information to vendor" 
                description="Add the information on T&T report." 
              />
            </Step>

            <Step number="9" title="Request Daily Track and Trace report and share with customer">
              <Task 
                icon={Clock}
                title="Request the distribution list" 
                description="Request from customer and provide to vendor." 
              />
            </Step>
          </div>
        )}

        {activeSopTab === 'transport-hpt' && (
          <div className="space-y-2">
            <Step number="1" title="Vendor Assigned" subtitle="(Contract Management Team will assign the Vendor and issue PO)">
              <Task 
                icon={Truck}
                title="Files to be shared with Vendor" 
                description={"1. Cargo value for the transportation insurance\n2. Site Contact Information (for site visit)\n3. Estimated loading date (HPT)\n4. Shipping Drawing"} 
              />
            </Step>

            <Step number="2" title="Requests to vendor">
              <Task 
                icon={Search}
                title="Required Vendor Actions" 
                description={"1. Site visit\n2. Route survey\n3. Rail car / Truck order\n4. Rail Clearance\n5. Road permit\n6. Preliminary transportation plan"} 
              />
            </Step>

            <Step number="3" title="Receive Preliminary transportation plan after site visit" subtitle="(review and share with customer)">
              <Decision condition="Customer Confirmation">
                <Path type="yes" title="If Confirmed">
                  Submit the final transportation plan when the transformer is ready to ship out.
                </Path>
                <Path type="no" title="If Rejected / Needs Revision">
                  <div className="space-y-2">
                    <p>1. Request revision based on the comments from customer.</p>
                    <p>2. Submit the revision for customer's approval.</p>
                  </div>
                </Path>
              </Decision>
            </Step>

            <Step number="4" title="Check Rail clearance & road permit status">
              <Decision condition="Approval Status">
                <Path type="yes" title="If All Approved">
                  Be ready to ship out the unit.
                </Path>
                <Path type="no" title="If Pending">
                  <div className="space-y-2">
                    <p>1. Check the status with vendor until the final approval.</p>
                    <p>2. If all approved, be ready to ship the unit.</p>
                  </div>
                </Path>
              </Decision>
              <div className="mt-6">
                <Task 
                  icon={FileCheck}
                  title="Request tie down and securement drawing" 
                  description="Request from vendor and provide to HPT." 
                />
              </div>
            </Step>

            <Step number="5" title="CSX Inspection & Dew point check">
              <Decision condition="Inspection Result">
                <Path type="yes" title="If Pass">
                  Ready for the shipment.
                </Path>
                <Path type="no" title="If Fail">
                  Redo inspection and the dew point check.
                </Path>
              </Decision>
            </Step>

            <Step number="6" title="Ship out the unit">
              <Decision condition="Shipment Status">
                <Path type="yes" title="If unit is shipped out">
                  <div className="space-y-2">
                    <p>1. Request for the shipping approval letter sign and return to HPT.</p>
                    <p>2. Process Inventory based on shipping approval letter.</p>
                  </div>
                </Path>
                <Path type="no" title="If Store unit (Not shipped)">
                  <div className="space-y-2">
                    <p>1. Submit acceptance letter and Bill and Hold letter to HPT.</p>
                    <p>2. Process Inventory based on acceptance letter.</p>
                    <p>3. Submit signed shipping approval letter to HPT.</p>
                  </div>
                </Path>
              </Decision>
              <div className="mt-6">
                <Task 
                  icon={MapPin}
                  title="Provide GPS information to vendor" 
                  description="Add the information on T&T report." 
                />
              </div>
            </Step>

            <Step number="7" title="Request Daily Track and Trace report and share with customer">
              <Task 
                icon={Clock}
                title="Request the distribution list" 
                description="Request from customer and provide to vendor." 
              />
            </Step>

            <Step number="8" title="Work with HPT and Vendor for the accessory pick up & delivery">
              <Task 
                icon={Truck}
                title="Coordinate accessory logistics" 
              />
            </Step>
          </div>
        )}

        {activeSopTab === 'installation' && (
          <div className="space-y-2">
            <SectionHeader title="1) Setting Up the Assembly/Testing Schedule" />
            
            <Step number="1" title="Vendor Assigned" subtitle="(Contract Management Team will assign the Vendor and issue PO)">
              <Task 
                icon={Wrench}
                title="Files to be shared with Vendor" 
                description={"1. FAT Report + SFRA raw data (from factory PM or PE)\n2. Site Contact Information\n3. Drawing Package (from factory PE)"} 
              />
            </Step>

            <Step number="2" title="Assembly/Testing Schedule with Vendor">
              <Task 
                icon={Calendar}
                title="Based on the Transformer on-site arrival date" 
                description="** Request for Daily Installation Schedule" 
              />
            </Step>

            <Step number="3" title="Confirm Assembly/Testing Schedule with Customer">
              <Decision condition="Customer Feedback">
                <Path type="info" title="If customer wants adjustment">
                  Re-check with Vendor on the availability.
                </Path>
                <Path type="yes" title="If customer confirms">
                  <div className="space-y-6">
                    <Task icon={Truck} title="Request Oil Delivery to CM Team" description="(Use 'Oil Request' Form)" />
                    <Task icon={FileText} title="Request Field Supervision to the factory" description={"HDE units → HDE\nHPT units → HPT\n(Use 'SV Request' Form)"}>
                      <Decision condition="Unit Type">
                        <Path type="info" title="For HPT unit only">
                          ** HPT SV PO should already have been included with Main Body PO.
                        </Path>
                        <Path type="info" title="For HDE unit only">
                          <div className="font-bold mb-3 text-slate-800 flex items-center gap-2">
                            <HelpCircle size={18} className="text-slate-400" />
                            Factory SV Available?
                          </div>
                          <div className="space-y-3 pl-2 md:pl-6 border-l-2 border-slate-100">
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                              <span className="font-bold text-emerald-600 block mb-1">Yes:</span> 
                              <span className="text-slate-600">Create and Provide Supervision PO to HDE Sales Manager.</span>
                            </div>
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                              <span className="font-bold text-rose-600 block mb-1">No:</span> 
                              <span className="text-slate-600">Look for an alternative options (HPT or 3rd Party like NABS / Saber Power / Trans Utility / Aubrey Silvey) → Create and Provide Supervision PO to assigned party.</span>
                            </div>
                          </div>
                        </Path>
                      </Decision>
                    </Task>
                  </div>
                </Path>
              </Decision>
            </Step>

            <SectionHeader title="2) When Site Issue arises during Assembly/Testing" />

            <Step number="4" title="Site Issue Occurred">
              <Decision condition="Unit Type">
                <Path type="info" title="For HDE unit">
                  <Task 
                    variant="alert"
                    icon={ShieldAlert}
                    title="Reach out to PE and Field Service Team" 
                    description={"* PE for each project\n\n1) Include '[Urgent]' in email subject line.\n2) Let them know the Due Date for their review/response.\n3) If no response from HDE, stop all works."} 
                  />
                </Path>
                <Path type="info" title="For HPT unit">
                  <Task 
                    icon={AlertCircle}
                    title="Reach out to PE and Field Service Team" 
                    description="* PE for each project" 
                  />
                </Path>
              </Decision>
            </Step>

            <SectionHeader title="3) After Assembly/Testing completion" />

            <Step number="5" title="Assembly/Testing Completed">
              <Task 
                icon={CheckCircle2}
                title="Process 'Sales Recognition'" 
                description={"1. Installation (T1Q/T2Q)\n2. Supervision (T1V/T2V)\n3. Oil (T1W/T2W)\n\n** Refer to SAP Process for Sales Recognition."} 
              />
            </Step>

            <Step number="6" title="Received Field Test Report (SAT Report) + Raw Data from Installation vendor">
              <Decision condition="Unit Type">
                <Path type="info" title="For HDE unit">
                  <div className="font-bold mb-3 text-slate-800 flex items-center gap-2">
                    <HelpCircle size={18} className="text-slate-400" />
                    Request Field Service Team to review/confirm
                  </div>
                  <div className="space-y-3 pl-2 md:pl-6 border-l-2 border-slate-100">
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                      <span className="font-bold text-emerald-600 block mb-1">Confirmed:</span> 
                      <span className="text-slate-600">Provide Field Test Report to the Customer.</span>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                      <span className="font-bold text-amber-600 block mb-1">Requires clarification:</span> 
                      <span className="text-slate-600">Request Installation Vendor to review → Request Field Service Team to review/confirm → Confirmed → Provide Field Test Report to the Customer.</span>
                    </div>
                  </div>
                </Path>
                <Path type="info" title="For HPT unit">
                  <div className="font-bold mb-3 text-slate-800 flex items-center gap-2">
                    <HelpCircle size={18} className="text-slate-400" />
                    Request Testing Team to review/confirm
                  </div>
                  <div className="space-y-3 pl-2 md:pl-6 border-l-2 border-slate-100">
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                      <span className="font-bold text-emerald-600 block mb-1">Confirmed:</span> 
                      <span className="text-slate-600">Provide Field Test Report to the Customer.</span>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                      <span className="font-bold text-amber-600 block mb-1">Requires clarification:</span> 
                      <span className="text-slate-600">Request Installation Vendor to review → Request Testing Team to review/confirm → Confirmed → Provide Field Test Report to the Customer.</span>
                    </div>
                  </div>
                </Path>
              </Decision>
            </Step>

          </div>
        )}
      </div>
    </div>
  );
}
